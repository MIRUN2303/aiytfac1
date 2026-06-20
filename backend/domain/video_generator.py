import os
import subprocess
import json
import logging
import tempfile
import textwrap
import asyncio

logger = logging.getLogger(__name__)


def _get_image_duration(scenes, scene_index, default_duration=5.0):
    if scene_index < len(scenes):
        return max(scenes[scene_index].get("duration_seconds", default_duration), 2.0)
    return default_duration


async def render_video(scenes, image_results, voice_path, subtitle_paths, project_dir, progress_callback=None):
    video_dir = os.path.join(project_dir, "video")
    os.makedirs(video_dir, exist_ok=True)
    output_path = os.path.join(video_dir, "final.mp4")

    images = []
    for r in image_results:
        path = r.get("path")
        if path and path.lower().endswith((".png", ".jpg", ".jpeg")):
            images.append(path)

    if not images:
        fallback_path = os.path.join(video_dir, "final.txt")
        with open(fallback_path, "w") as f:
            f.write("Video generation skipped: no images available\n")
        if progress_callback:
            await progress_callback("RENDERING", 100)
        return fallback_path

    if progress_callback:
        await progress_callback("EDITING_VIDEO", 30)

    voice_exists = os.path.exists(voice_path) and os.path.getsize(voice_path) > 100
    created = False

    if voice_exists and _check_moviepy():
        created = await _render_with_moviepy(scenes, images, voice_path, subtitle_paths, video_dir, output_path, progress_callback)

    if not created:
        created = await _render_with_ffmpeg(scenes, images, voice_path, video_dir, output_path, progress_callback)

    if not created:
        created = await _render_with_ffmpeg_simple(images, video_dir, output_path, progress_callback)

    if progress_callback:
        await progress_callback("RENDERING", 100)

    if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        logger.info(f"Video rendered: {output_path} ({os.path.getsize(output_path)} bytes)")
        return output_path

    fallback_path = os.path.join(video_dir, "final.txt")
    with open(fallback_path, "w") as f:
        f.write("Video rendering attempted but failed to produce output\n")
    return fallback_path


def _check_moviepy():
    try:
        import moviepy.editor
        return True
    except ImportError:
        return False


async def _render_with_moviepy(scenes, images, voice_path, subtitle_paths, video_dir, output_path, progress_callback):
    try:
        from moviepy.editor import ImageClip, AudioFileClip, CompositeVideoClip, concatenate_videoclips, TextClip, CompositeAudioClip
        from moviepy.video.fx import resize

        if progress_callback:
            await progress_callback("EDITING_VIDEO", 40)

        clips = []
        for i, img_path in enumerate(images):
            duration = _get_image_duration(scenes, i)
            clip = ImageClip(img_path, duration=duration)

            scene_idx = min(i, len(scenes) - 1)
            scene = scenes[scene_idx] if scene_idx >= 0 else {}
            movement = scene.get("movement_style", "static")

            if "zoom in" in movement or "push in" in movement or "dolly in" in movement:
                clip = clip.resize(lambda t: 1 + 0.05 * (t / max(duration, 1)))
            elif "zoom out" in movement or "pull out" in movement or "pull back" in movement:
                clip = clip.resize(lambda t: 1.05 - 0.05 * (t / max(duration, 1)))
            elif "Ken Burns" in movement:
                clip = clip.resize(lambda t: 1 + 0.03 * (t / max(duration, 1)))

            if "pan right" in movement or "tracking right" in movement:
                clip = clip.resize(lambda t: 1.1).set_position(lambda t: (-10 * t / max(duration, 1), 0))
            elif "pan left" in movement or "tracking left" in movement:
                clip = clip.resize(lambda t: 1.1).set_position(lambda t: (10 * t / max(duration, 1), 0))

            clips.append(clip)

        if progress_callback:
            await progress_callback("EDITING_VIDEO", 60)

        video = concatenate_videoclips(clips, method="compose")

        if voice_path and os.path.exists(voice_path):
            try:
                audio = AudioFileClip(voice_path)
                if audio.duration < video.duration:
                    audio = audio.loop(duration=video.duration)
                video = video.set_audio(audio)
            except Exception as e:
                logger.warning(f"Could not add voice audio: {e}")

        if progress_callback:
            await progress_callback("EDITING_VIDEO", 80)

        has_subtitles = subtitle_paths and subtitle_paths.get("vtt") and os.path.exists(subtitle_paths.get("vtt", ""))
        if has_subtitles:
            try:
                subs = []
                with open(subtitle_paths["vtt"], "r", encoding="utf-8") as f:
                    content = f.read()

                import re as regex
                blocks = regex.split(r"\n\n+", content)
                for block in blocks:
                    if "-->" in block and not block.startswith("WEBVTT"):
                        lines = block.strip().split("\n")
                        if len(lines) >= 2:
                            time_part = lines[0]
                            text_part = "\n".join(lines[1:])
                            match = regex.match(r"(\d+:\d+:\d+\.\d+)\s*-->\s*(\d+:\d+:\d+\.\d+)", time_part)
                            if match:
                                start_str, end_str = match.groups()
                                start_parts = [float(x) for x in start_str.replace(".", ":").split(":")]
                                end_parts = [float(x) for x in end_str.replace(".", ":").split(":")]
                                start_sec = start_parts[0] * 3600 + start_parts[1] * 60 + start_parts[2]
                                end_sec = end_parts[0] * 3600 + end_parts[1] * 60 + end_parts[2]
                                duration = end_sec - start_sec
                                try:
                                    txt_clip = TextClip(text_part, fontsize=36, color="white",
                                                        font="Arial", stroke_color="black", stroke_width=2,
                                                        method="label")
                                    txt_clip = txt_clip.set_start(start_sec).set_duration(duration).set_position(("center", "bottom"))
                                    subs.append(txt_clip)
                                except Exception:
                                    pass

                if subs:
                    video = CompositeVideoClip([video] + subs)
            except Exception as e:
                logger.warning(f"Could not add subtitles: {e}")

        if progress_callback:
            await progress_callback("RENDERING", 20)

        video = video.resize(width=1920, height=1080)
        video.write_videofile(output_path, codec="libx264", audio_codec="aac",
                              fps=24, preset="medium", bitrate="5000k",
                              threads=2, logger=None)

        video.close()

        if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            logger.info(f"MoviePy rendered video: {output_path}")
            return True
        return False
    except Exception as e:
        logger.warning(f"MoviePy rendering failed: {e}")
        return False


async def _render_with_ffmpeg(scenes, images, voice_path, video_dir, output_path, progress_callback):
    try:
        if progress_callback:
            await progress_callback("EDITING_VIDEO", 30)

        temp_dir = tempfile.mkdtemp()
        concat_file = os.path.join(temp_dir, "concat.txt")

        with open(concat_file, "w", encoding="utf-8") as f:
            for i, img_path in enumerate(images):
                duration = _get_image_duration(scenes, i)
                abs_path = os.path.abspath(img_path).replace("\\", "/").replace(":", "\\\\:")
                f.write(f"file '{abs_path}'\n")
                f.write(f"duration {duration}\n")
            last_abs = os.path.abspath(images[-1]).replace("\\", "/").replace(":", "\\\\:")
            f.write(f"file '{last_abs}'\n")

        voice_exists = voice_path and os.path.exists(voice_path) and os.path.getsize(voice_path) > 100

        if voice_exists:
            voice_abs = os.path.abspath(voice_path).replace("\\", "/")
            cmd = [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concat_file,
                "-i", voice_abs,
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-preset", "medium",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                "-r", "24",
                "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
                output_path,
            ]
        else:
            cmd = [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concat_file,
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-preset", "medium",
                "-crf", "23",
                "-r", "24",
                "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
                output_path,
            ]

        if progress_callback:
            await progress_callback("RENDERING", 10)

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

        if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            logger.info(f"FFmpeg rendered video: {output_path}")
            return True
        else:
            logger.warning(f"FFmpeg failed: {result.stderr[:300]}")
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
        concat_file = os.path.join(temp_dir, "concat.txt")

        with open(concat_file, "w", encoding="utf-8") as f:
            for img_path in images:
                abs_path = os.path.abspath(img_path).replace("\\", "/").replace(":", "\\\\:")
                f.write(f"file '{abs_path}'\n")
                f.write("duration 5\n")
            last_abs = os.path.abspath(images[-1]).replace("\\", "/").replace(":", "\\\\:")
            f.write(f"file '{last_abs}'\n")

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

                if _check_moviepy():
                    from moviepy.editor import ImageClip, TextClip, CompositeVideoClip

                    clip = ImageClip(cropped_path, duration=duration)
                    clip = clip.resize(lambda t: 1 + 0.02 * (t / max(duration, 1)))

                    narration = scene.get("narration", "")
                    txt_clip = TextClip(narration[:200], fontsize=48, color="white",
                                        font="Arial", stroke_color="black", stroke_width=3,
                                        method="label")
                    txt_clip = txt_clip.set_position(("center", "bottom")).set_duration(duration)

                    final = CompositeVideoClip([clip, txt_clip], size=(target_w, target_h))
                    final.write_videofile(output_path, codec="libx264", audio_codec="aac",
                                          fps=24, preset="medium", bitrate="3000k",
                                          threads=2, logger=None)
                    final.close()
                    short_created = True

                if not short_created:
                    temp_dir = tempfile.mkdtemp()
                    concat_file = os.path.join(temp_dir, "short_concat.txt")
                    abs_path = os.path.abspath(cropped_path).replace("\\", "/").replace(":", "\\\\:")
                    with open(concat_file, "w") as f:
                        f.write(f"file '{abs_path}'\n")
                        f.write(f"duration {duration}\n")
                        f.write(f"file '{abs_path}'\n")

                    cmd = [
                        "ffmpeg", "-y",
                        "-f", "concat", "-safe", "0",
                        "-i", concat_file,
                        "-c:v", "libx264",
                        "-pix_fmt", "yuv420p",
                        "-preset", "medium",
                        "-crf", "23",
                        "-vf", f"scale={target_w}:{target_h}",
                        output_path,
                    ]
                    subprocess.run(cmd, capture_output=True, timeout=300)
                    import shutil
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

    return output_path if short_created else (fallback if 'fallback' in dir() else os.path.join(shorts_dir, "short.txt"))
