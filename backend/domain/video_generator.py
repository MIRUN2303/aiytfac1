import os
import subprocess
import json
import logging
import tempfile
import asyncio

logger = logging.getLogger(__name__)


def _get_image_duration(scenes, scene_index, default_duration=5.0):
    if scene_index < len(scenes):
        return max(scenes[scene_index].get("duration_seconds", default_duration), 2.0)
    return default_duration


def _is_valid_image(path: str) -> bool:
    if not path or not os.path.exists(path):
        return False
    ext = os.path.splitext(path)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        return False
    size = os.path.getsize(path)
    if size < 500:
        return False
    try:
        from PIL import Image
        with Image.open(path) as img:
            img.verify()
        return True
    except Exception:
        return False


async def render_video(scenes, image_results, voice_path, subtitle_paths, project_dir, progress_callback=None):
    video_dir = os.path.join(project_dir, "video")
    os.makedirs(video_dir, exist_ok=True)
    output_path = os.path.join(video_dir, "final.mp4")

    valid_images = []
    for r in image_results:
        path = r.get("path")
        if _is_valid_image(path):
            valid_images.append(path)

    if not valid_images:
        fallback_path = os.path.join(video_dir, "final.txt")
        with open(fallback_path, "w") as f:
            f.write("Video generation skipped: no valid images\n")
        if progress_callback:
            await progress_callback("RENDERING", 100)
        return fallback_path

    if progress_callback:
        await progress_callback("EDITING_VIDEO", 30)

    created = False
    voice_exists = voice_path and os.path.exists(voice_path) and os.path.getsize(voice_path) > 500

    created = await _render_with_ffmpeg(scenes, valid_images, voice_path if voice_exists else None,
                                        video_dir, output_path, progress_callback)

    if not created:
        created = await _render_with_ffmpeg_simple(valid_images, video_dir, output_path, progress_callback)

    if progress_callback:
        await progress_callback("RENDERING", 100)

    if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        logger.info(f"Video rendered: {output_path} ({os.path.getsize(output_path)} bytes)")
        return output_path

    fallback_path = os.path.join(video_dir, "final.txt")
    with open(fallback_path, "w") as f:
        f.write("Video rendering attempted but failed to produce output\n")
    return fallback_path


async def _render_with_ffmpeg(scenes, images, voice_path, video_dir, output_path, progress_callback):
    try:
        if progress_callback:
            await progress_callback("EDITING_VIDEO", 30)

        temp_dir = tempfile.mkdtemp()

        for i, img_path in enumerate(images):
            duration = _get_image_duration(scenes, i)
            frame_path = os.path.join(temp_dir, f"frame_{i:04d}.png")
            try:
                from PIL import Image
                img = Image.open(img_path)
                if img.size != (1920, 1080):
                    img = img.resize((1920, 1080), Image.LANCZOS)
                img.save(frame_path, "PNG")
            except Exception:
                import shutil
                shutil.copy2(img_path, frame_path)

        concat_file = os.path.join(temp_dir, "concat.txt")
        with open(concat_file, "w", encoding="utf-8") as f:
            for i, img_path in enumerate(images):
                duration = _get_image_duration(scenes, i)
                frame_name = f"frame_{i:04d}.png"
                f.write(f"file '{frame_name}'\n")
                f.write(f"duration {duration}\n")
            last_frame = f"frame_{len(images)-1:04d}.png"
            f.write(f"file '{last_frame}'\n")

        has_subtitles = subtitle_paths and subtitle_paths.get("srt") and os.path.exists(subtitle_paths.get("srt", ""))

        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file,
        ]

        if voice_path:
            cmd.extend(["-i", voice_path])

        filter_parts = ["scale=1920:1080,setsar=1"]
        if has_subtitles:
            srt_path = os.path.abspath(subtitle_paths["srt"])
            srt_escaped = srt_path.replace("\\", "/").replace(":", "\\:")
            filter_parts.append(f"subtitles={srt_escaped}")

        cmd.extend([
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "medium",
            "-crf", "23",
            "-vf", ",".join(filter_parts),
            "-r", "24",
        ])

        if voice_path:
            cmd.extend(["-c:a", "aac", "-b:a", "192k", "-shortest"])
        else:
            cmd.extend(["-an"])

        cmd.append(output_path)

        if progress_callback:
            await progress_callback("RENDERING", 10)

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

        if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            logger.info(f"FFmpeg rendered video: {output_path}")
            return True
        else:
            stderr_sample = result.stderr[:500] if result.stderr else "no stderr"
            logger.warning(f"FFmpeg failed (returncode={result.returncode}): {stderr_sample}")
            return False
    except FileNotFoundError:
        logger.warning("FFmpeg not found")
        return False
    except subprocess.TimeoutExpired:
        logger.warning("FFmpeg timed out")
        return False
    except Exception as e:
        logger.warning(f"FFmpeg render error: {e}")
        return False


async def _render_with_ffmpeg_simple(images, video_dir, output_path, progress_callback):
    try:
        temp_dir = tempfile.mkdtemp()

        for i, img_path in enumerate(images):
            frame_path = os.path.join(temp_dir, f"frame_{i:04d}.png")
            try:
                from PIL import Image
                img = Image.open(img_path)
                if img.size != (1920, 1080):
                    img = img.resize((1920, 1080), Image.LANCZOS)
                img.save(frame_path, "PNG")
            except Exception:
                import shutil
                shutil.copy2(img_path, frame_path)

        concat_file = os.path.join(temp_dir, "concat.txt")
        with open(concat_file, "w", encoding="utf-8") as f:
            for i in range(len(images)):
                f.write(f"file 'frame_{i:04d}.png'\n")
                f.write("duration 5\n")
            last_frame = f"frame_{len(images)-1:04d}.png"
            f.write(f"file '{last_frame}'\n")

        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "ultrafast",
            "-crf", "28",
            "-r", "24",
            "-vf", "scale=1920:1080,setsar=1",
            "-an",
            output_path,
        ]

        if progress_callback:
            await progress_callback("RENDERING", 10)

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

        if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            logger.info(f"FFmpeg simple render: {output_path}")
            return True
        return False
    except Exception as e:
        logger.warning(f"FFmpeg simple render failed: {e}")
        return False


async def generate_shorts(scenes, image_results, project_dir, progress_callback=None):
    shorts_dir = os.path.join(project_dir, "shorts")
    os.makedirs(shorts_dir, exist_ok=True)
    output_path = os.path.join(shorts_dir, "short.mp4")

    key_scenes = []
    dramatic_keywords = ["climax", "twist", "dramatic", "intense", "conflict", "reveal", "discover", "shock"]

    for i, scene in enumerate(scenes):
        title_lower = scene.get("title", "").lower()
        narration_lower = scene.get("narration", "").lower()
        if any(kw in title_lower or kw in narration_lower for kw in dramatic_keywords):
            key_scenes.append((i, scene))

    if not key_scenes and scenes:
        mid = len(scenes) // 2
        key_scenes = [(mid, scenes[mid])]

    short_created = False
    for scene_idx, scene in key_scenes[:1]:
        img_path = None
        for r in image_results:
            if r.get("scene") == scene_idx + 1 and r.get("path"):
                img_path = r["path"]
                break
        if not img_path and image_results:
            img_path = image_results[0].get("path")

        if img_path and os.path.exists(img_path):
            try:
                from PIL import Image
                img = Image.open(img_path)
                w, h = img.size
                target_w, target_h = 1080, 1920

                if w / h > target_w / target_h:
                    new_h = h
                    new_w = int(h * target_w / target_h)
                else:
                    new_w = w
                    new_h = int(w * target_h / target_w)

                left = (w - new_w) // 2
                top = (h - new_h) // 2
                img_cropped = img.crop((left, top, left + new_w, top + new_h))
                img_cropped = img_cropped.resize((target_w, target_h), Image.LANCZOS)
                cropped_path = os.path.join(shorts_dir, f"short_scene_{scene_idx + 1}.png")
                img_cropped.save(cropped_path)

                duration = max(scene.get("duration_seconds", 10), 5)
                temp_dir = tempfile.mkdtemp()
                concat_file = os.path.join(temp_dir, "short_concat.txt")
                with open(concat_file, "w") as f:
                    f.write(f"file 'cropped.png'\n")
                    f.write(f"duration {duration}\n")
                    f.write(f"file 'cropped.png'\n")

                import shutil
                shutil.copy2(cropped_path, os.path.join(temp_dir, "cropped.png"))

                cmd = [
                    "ffmpeg", "-y",
                    "-f", "concat", "-safe", "0",
                    "-i", concat_file,
                    "-c:v", "libx264",
                    "-pix_fmt", "yuv420p",
                    "-preset", "medium",
                    "-crf", "23",
                    "-vf", f"scale={target_w}:{target_h}",
                    "-an",
                    output_path,
                ]
                subprocess.run(cmd, capture_output=True, timeout=300)
                shutil.rmtree(temp_dir, ignore_errors=True)
                short_created = True
            except Exception as e:
                logger.warning(f"Short video generation failed: {e}")

    if not short_created:
        fallback = os.path.join(shorts_dir, "short.txt")
        with open(fallback, "w") as f:
            f.write("Short video generation skipped\n")

    if progress_callback:
        await progress_callback("GENERATING_SHORTS", 100)

    return output_path if short_created else (fallback if 'fallback' in locals() else os.path.join(shorts_dir, "short.txt"))
