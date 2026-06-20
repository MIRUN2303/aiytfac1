import os
import json
import logging
import shutil
from datetime import datetime, timezone

from domain.story_generator import generate_story
from domain.scene_generator import generate_scenes
from domain.image_generator import generate_scene_images
from domain.voice_generator import generate_voice
from domain.subtitle_generator import generate_subtitles
from domain.thumbnail_generator import generate_thumbnail
from domain.video_generator import render_video, generate_shorts
from domain.metadata_generator import generate_metadata
from infrastructure.logging_service import log_event
from infrastructure.upload_service import upload_to_youtube
from models import LogLevel

logger = logging.getLogger("pipeline")

PROJECTS_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "projects")


def _get_project_dir(project_id, topic):
    safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in topic)[:50].strip()
    path = os.path.join(PROJECTS_ROOT, f"{project_id}_{safe_name}")
    os.makedirs(path, exist_ok=True)
    return path


async def run_pipeline(project_id, project_data, progress_callback):
    topic = project_data.get("topic", "Unknown Topic")
    summary = project_data.get("summary", "")
    language = project_data.get("language", "en")
    target_audience = project_data.get("target_audience", "general")
    duration = project_data.get("duration", "medium")
    voice_style = project_data.get("voice_style", "neutral")
    story_style = project_data.get("story_style", "narrative")

    duration_map = {"short": 3, "medium": 8, "long": 15}
    duration_minutes = duration_map.get(duration, 8)
    project_dir = _get_project_dir(project_id, topic)

    dirs = ["script", "voice", "images", "subtitles", "thumbnail", "video", "shorts", "metadata", "logs"]
    for d in dirs:
        os.makedirs(os.path.join(project_dir, d), exist_ok=True)

    log_path = os.path.join(project_dir, "logs", "process.log")

    def log(msg, level="INFO"):
        line = f"[{datetime.now(timezone.utc).isoformat()}] [{level}] {msg}"
        getattr(logger, level.lower(), logger.info)(line)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    story = None
    scenes = None
    image_results = None
    voice_path = None
    subtitle_paths = None
    thumb_path = None
    video_path = None
    short_path = None

    try:
        log("Pipeline started", "INFO")
        await log_event(LogLevel.INFO, "pipeline", f"Pipeline started for project {project_id}", project_id)

        # Stage 1: Generate Story
        log("Stage 1/10: Generating story...")
        await progress_callback("GENERATING_SCRIPT", 0)
        story = generate_story(topic, summary, story_style)
        await log_event(LogLevel.INFO, "pipeline", f"Story generated: {story['title']}", project_id)
        await _save_checkpoint(project_id, "GENERATING_SCRIPT", story=story)
        story_path = os.path.join(project_dir, "script", "story.json")
        with open(story_path, "w", encoding="utf-8") as f:
            json.dump(story, f, indent=2)
        log(f"Story generated: {story['title']}", "INFO")
        await progress_callback("GENERATING_SCRIPT", 100)

        # Stage 2: Generate Metadata
        log("Stage 2/10: Generating metadata...")
        await progress_callback("GENERATING_METADATA", 0)
        metadata = generate_metadata(story, project_dir)
        await _save_checkpoint(project_id, "GENERATING_METADATA", metadata=metadata)
        log("Metadata generated", "INFO")
        await progress_callback("GENERATING_METADATA", 100)

        # Stage 3: Generate Scenes
        log("Stage 3/10: Generating scenes...")
        await progress_callback("GENERATING_SCENES", 0)
        scenes = generate_scenes(story, duration_minutes)
        scenes_path = os.path.join(project_dir, "script", "scenes.json")
        with open(scenes_path, "w", encoding="utf-8") as f:
            json.dump(scenes, f, indent=2)
        await _save_checkpoint(project_id, "GENERATING_SCENES", scenes=scenes)
        log(f"{len(scenes)} scenes generated", "INFO")
        await progress_callback("GENERATING_SCENES", 100)

        # Stage 4: Generate Images
        log("Stage 4/10: Generating images...")
        image_results = await generate_scene_images(scenes, project_dir, progress_callback)
        success_count = sum(1 for r in image_results if r.get("path"))
        log(f"{success_count}/{len(image_results)} images generated", "INFO")
        await _save_checkpoint(project_id, "GENERATING_IMAGES", image_results=image_results)
        await progress_callback("GENERATING_IMAGES", 100)

        # Stage 5: Generate Voice
        log("Stage 5/10: Generating voice...")
        await progress_callback("GENERATING_VOICE", 0)
        voice_path = await generate_voice(scenes, project_dir, voice_style, progress_callback)
        await _save_checkpoint(project_id, "GENERATING_VOICE", voice_path=voice_path)
        log(f"Voice saved to {voice_path}", "INFO")
        await progress_callback("GENERATING_VOICE", 100)

        # Stage 6: Generate Subtitles
        log("Stage 6/10: Generating subtitles...")
        await progress_callback("GENERATING_SUBTITLES", 0)
        subtitle_paths = await generate_subtitles(scenes, project_dir, progress_callback)
        await _save_checkpoint(project_id, "GENERATING_SUBTITLES", subtitle_paths=subtitle_paths)
        log("Subtitles generated", "INFO")
        await progress_callback("GENERATING_SUBTITLES", 100)

        # Stage 7: Generate Thumbnail
        log("Stage 7/10: Generating thumbnail...")
        await progress_callback("GENERATING_THUMBNAIL", 0)
        thumb_path = await generate_thumbnail(story, project_dir, progress_callback)
        await _save_checkpoint(project_id, "GENERATING_THUMBNAIL", thumb_path=thumb_path)
        log(f"Thumbnail saved to {thumb_path}", "INFO")
        await progress_callback("GENERATING_THUMBNAIL", 100)

        # Stage 8: Edit and Render Video
        log("Stage 8/10: Rendering video...")
        await progress_callback("EDITING_VIDEO", 0)
        video_path = await render_video(scenes, image_results, voice_path, subtitle_paths, project_dir, progress_callback)
        await _save_checkpoint(project_id, "RENDERING", video_path=video_path)
        log(f"Video saved to {video_path}", "INFO")
        await progress_callback("RENDERING", 100)

        # Stage 9: Generate Shorts
        log("Stage 9/10: Generating shorts...")
        await progress_callback("GENERATING_SHORTS", 0)
        short_path = await generate_shorts(scenes, image_results, project_dir, progress_callback)
        await _save_checkpoint(project_id, "GENERATING_SHORTS", short_path=short_path)
        log(f"Shorts saved to {short_path}", "INFO")
        await progress_callback("GENERATING_SHORTS", 100)

        # Stage 10: Upload
        log("Stage 10/10: Preparing upload...")
        await progress_callback("UPLOADING", 0)
        if video_path and video_path.endswith(".mp4"):
            try:
                upload_result = await upload_to_youtube(
                    project_id, video_path,
                    title=story.get("title", topic),
                    description=story.get("seo_description", ""),
                    tags=story.get("tags", []),
                )
                log(f"Upload: {upload_result.get('video_url', 'simulated')}", "INFO")
            except Exception as e:
                log(f"Upload failed (non-critical): {e}", "WARN")
        await progress_callback("UPLOADING", 100)

        # Complete
        await _update_project_complete(project_id, project_dir, video_path, short_path, thumb_path,
                                        subtitle_paths, voice_path, story, metadata)
        log("Pipeline completed successfully!", "INFO")
        await log_event(LogLevel.INFO, "pipeline", f"Pipeline completed for project {project_id}", project_id)
        await progress_callback("COMPLETED", 100)

    except Exception as e:
        log(f"Pipeline failed at stage: {e}", "ERROR")
        logger.exception("Pipeline error")
        await log_event(LogLevel.ERROR, "pipeline", f"Pipeline failed: {e}", project_id, {"error": str(e)})
        await progress_callback("FAILED", 0)

        try:
            async with _get_session() as session:
                from sqlalchemy import select
                from models import Project
                result = await session.execute(select(Project).where(Project.id == project_id))
                project = result.scalar_one_or_none()
                if project:
                    if project.logs is None:
                        project.logs = []
                    project.logs.append({"time": datetime.now(timezone.utc).isoformat(), "error": str(e)})
                    await session.commit()
        except Exception:
            pass

        raise


async def _save_checkpoint(project_id, stage, **kwargs):
    try:
        async with _get_session() as session:
            from sqlalchemy import select
            from models import Project
            result = await session.execute(select(Project).where(Project.id == project_id))
            project = result.scalar_one_or_none()
            if project:
                project.checkpoint = stage
                await session.commit()
    except Exception as e:
        logger.warning(f"Checkpoint save failed: {e}")


async def _update_project_complete(project_id, project_dir, video_path, short_path, thumb_path,
                                     subtitle_paths, voice_path, story, metadata):
    try:
        async with _get_session() as session:
            from sqlalchemy import select
            from models import Project, JobStatus
            result = await session.execute(select(Project).where(Project.id == project_id))
            project = result.scalar_one_or_none()
            if project:
                project.status = JobStatus.COMPLETED
                project.progress = 100
                project.project_dir = project_dir
                project.video_path = video_path
                project.short_path = short_path
                project.thumbnail_path = thumb_path
                project.voice_over_path = voice_path
                project.subtitle_paths_json = subtitle_paths
                project.metadata_json = metadata
                project.updated_at = datetime.now(timezone.utc)
                await session.commit()
    except Exception as e:
        logger.error(f"Project completion update failed: {e}")


def _get_session():
    from database import SessionLocal
    return SessionLocal()
