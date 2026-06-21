"""Debug/test endpoints — run each pipeline step independently via API."""
import os, json, asyncio, subprocess, tempfile, logging, base64
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("debug")

router = APIRouter(prefix="/debug", tags=["debug"])

@router.get("/ping")
async def ping():
    return {"ok": True, "message": "Debug endpoints active"}

@router.get("/env")
async def check_env():
    """Check environment: FFmpeg, edge-tts, Pillow, HF token."""
    checks = {}

    # FFmpeg
    try:
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=10)
        checks["ffmpeg"] = r.stdout.split("\n")[0] if r.stdout else "found"
    except Exception as e:
        checks["ffmpeg"] = f"ERROR: {e}"

    # edge-tts
    try:
        import edge_tts
        checks["edge_tts"] = "installed"
    except ImportError:
        checks["edge_tts"] = "NOT INSTALLED"

    # Pillow
    try:
        from PIL import Image
        checks["pillow"] = "installed"
    except ImportError:
        checks["pillow"] = "NOT INSTALLED"

    # HF token
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACEHUB_API_TOKEN")
    checks["hf_token"] = f"SET ({token[:8]}...{token[-4:]})" if token else "NOT SET"

    # httpx
    try:
        import httpx
        checks["httpx"] = "installed"
    except ImportError:
        checks["httpx"] = "NOT INSTALLED"

    return {"environment": checks}


@router.post("/test-hf")
async def test_hf(prompt: str = "A butterfly emerging from a cocoon, cinematic lighting"):
    """Test HF image generation with a specific prompt."""
    from infrastructure.hf_image_client import generate_image

    models_to_try = [
        "runwayml/stable-diffusion-v1-5",
        "stabilityai/stable-diffusion-2-1",
        "prompthero/openjourney-v4",
        "black-forest-labs/FLUX.1-dev",
    ]

    results = []
    for model in models_to_try:
        try:
            data = await generate_image(prompt, seed=42, model=model)
            if data and len(data) > 500:
                out_dir = "/tmp/debug_images"
                os.makedirs(out_dir, exist_ok=True)
                fn = os.path.join(out_dir, f"{model.split('/')[-1]}.png")
                with open(fn, "wb") as f:
                    f.write(data)
                results.append({"model": model, "status": "OK", "bytes": len(data), "file": fn})
                break
            else:
                sz = len(data) if data else 0
                results.append({"model": model, "status": f"FAIL (response {sz} bytes, need >500)"})
        except Exception as e:
            results.append({"model": model, "status": f"ERROR: {str(e)[:200]}"})

    if not results:
        return {"error": "No models tried", "results": []}

    # If all failed, try default chain
    if all(r["status"].startswith("FAIL") or r["status"].startswith("ERROR") for r in results):
        try:
            data = await generate_image(prompt, seed=42)
            if data and len(data) > 500:
                out_dir = "/tmp/debug_images"
                os.makedirs(out_dir, exist_ok=True)
                fn = os.path.join(out_dir, "default_chain.png")
                with open(fn, "wb") as f:
                    f.write(data)
                results.append({"model": "default_chain", "status": "OK", "bytes": len(data), "file": fn})
            else:
                sz = len(data) if data else 0
                results.append({"model": "default_chain", "status": f"FAIL ({sz} bytes)"})
        except Exception as e:
            results.append({"model": "default_chain", "status": f"ERROR: {str(e)[:200]}"})

    return {"prompt": prompt, "results": results}


@router.post("/test-voice")
async def test_voice(text: str = "This is a test of the voice generation system."):
    """Test edge-tts voice generation."""
    try:
        import edge_tts
    except ImportError:
        return {"error": "edge-tts not installed"}

    voices = ["en-US-JennyNeural", "en-US-GuyNeural", "en-GB-SoniaNeural"]
    results = []

    out_dir = "/tmp/debug_voice"
    os.makedirs(out_dir, exist_ok=True)

    for voice in voices:
        mp3_out = os.path.join(out_dir, f"{voice.replace('-', '_')}.mp3")
        wav_out = mp3_out.replace(".mp3", ".wav")
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(mp3_out)
            mp3_size = os.path.getsize(mp3_out) if os.path.exists(mp3_out) else 0
            if mp3_size > 500:
                # convert to WAV
                r = subprocess.run(
                    ["ffmpeg", "-y", "-i", mp3_out, "-acodec", "pcm_s16le",
                     "-ar", "22050", "-ac", "1", wav_out],
                    capture_output=True, text=True, timeout=60,
                )
                wav_size = os.path.getsize(wav_out) if os.path.exists(wav_out) else 0
                wav_ok = r.returncode == 0 and wav_size > 500
                results.append({
                    "voice": voice, "status": "OK",
                    "mp3_bytes": mp3_size, "wav_bytes": wav_size,
                    "wav_converted": wav_ok,
                })
                os.remove(mp3_out)
            else:
                results.append({"voice": voice, "status": f"FAIL (MP3 {mp3_size} bytes)"})
        except Exception as e:
            results.append({"voice": voice, "status": f"ERROR: {str(e)[:200]}"})

    return {"text_length": len(text), "results": results}


@router.post("/test-ffmpeg")
async def test_ffmpeg():
    """Test FFmpeg concat video assembly with generated frames."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return {"error": "Pillow not installed"}

    out_dir = "/tmp/debug_video"
    os.makedirs(out_dir, exist_ok=True)

    results = {}

    # Create test frames
    frames_dir = os.path.join(out_dir, "frames")
    os.makedirs(frames_dir, exist_ok=True)
    for i in range(5):
        img = Image.new("RGB", (1920, 1080), (20 + i * 50, 30, 80 + i * 20))
        d = ImageDraw.Draw(img)
        d.text((100, 500), f"Frame {i+1}", fill=(255, 255, 255))
        img.save(os.path.join(frames_dir, f"frame_{i:04d}.png"))
    results["frames_created"] = 5

    # Test 1: No audio
    tmp = tempfile.mkdtemp()
    import shutil
    for f in os.listdir(frames_dir):
        shutil.copy2(os.path.join(frames_dir, f), os.path.join(tmp, f))
    cf = os.path.join(tmp, "concat.txt")
    with open(cf, "w") as f:
        for i in range(5):
            f.write(f"file 'frame_{i:04d}.png'\nduration 3\n")
        f.write("file 'frame_0004.png'\n")

    out_na = os.path.join(out_dir, "test_no_audio.mp4")
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", cf,
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "23",
           "-vf", "scale=1920:1080,setsar=1", "-r", "24", "-an", out_na]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        sz = os.path.getsize(out_na) if os.path.exists(out_na) else 0
        results["no_audio"] = {"rc": r.returncode, "bytes": sz, "ok": r.returncode == 0 and sz > 1000}
        if r.returncode != 0:
            results["no_audio"]["error"] = r.stderr[-300:]
    except Exception as e:
        results["no_audio"] = {"error": str(e)}

    # Test 2: With subtitles
    srt = os.path.join(out_dir, "test.srt")
    with open(srt, "w") as f:
        f.write("1\n00:00:01,000 --> 00:00:04,000\nSubtitle line 1\n\n2\n00:00:05,000 --> 00:00:08,000\nSubtitle line 2\n\n")
    out_srt = os.path.join(out_dir, "test_subs.mp4")
    srt_e = srt.replace("\\", "/").replace(":", "\\:")
    cmd2 = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", cf,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "23",
            "-vf", f"scale=1920:1080,setsar=1,subtitles='{srt_e}'",
            "-r", "24", "-an", out_srt]
    try:
        r2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=120)
        sz = os.path.getsize(out_srt) if os.path.exists(out_srt) else 0
        results["with_subtitles"] = {"rc": r2.returncode, "bytes": sz, "ok": r2.returncode == 0 and sz > 1000}
        if r2.returncode != 0:
            results["with_subtitles"]["error"] = r2.stderr[-500:]
    except Exception as e:
        results["with_subtitles"] = {"error": str(e)}

    # Test 3: Shorts (9:16 vertical)
    try:
        img = Image.new("RGB", (1920, 1080), (50, 80, 150))
        target_w, target_h = 1080, 1920
        src_aspect = 1920 / 1080
        target_aspect = target_w / target_h
        if src_aspect > target_aspect:
            new_w = int(1080 * target_aspect)
            offset = (1920 - new_w) // 2
            cropped = img.crop((offset, 0, offset + new_w, 1080))
        else:
            new_h = int(1920 / target_aspect)
            offset = (1080 - new_h) // 2
            cropped = img.crop((0, offset, 1920, offset + new_h))
        cropped = cropped.resize((target_w, target_h), Image.LANCZOS)
        crop_path = os.path.join(out_dir, "short_frame.png")
        cropped.save(crop_path)

        short_tmp = tempfile.mkdtemp()
        shutil.copy2(crop_path, os.path.join(short_tmp, "cropped.png"))
        sc = os.path.join(short_tmp, "short_concat.txt")
        with open(sc, "w") as f:
            f.write("file 'cropped.png'\nduration 5\nfile 'cropped.png'\n")
        out_short = os.path.join(out_dir, "test_short.mp4")
        cmd3 = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", sc,
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "23",
                "-vf", f"scale={target_w}:{target_h}", "-an", out_short]
        r3 = subprocess.run(cmd3, capture_output=True, text=True, timeout=120)
        sz = os.path.getsize(out_short) if os.path.exists(out_short) else 0
        results["short"] = {"rc": r3.returncode, "bytes": sz, "ok": r3.returncode == 0 and sz > 5000}
        if r3.returncode != 0:
            results["short"]["error"] = r3.stderr[-200:]
        shutil.rmtree(short_tmp, ignore_errors=True)
    except Exception as e:
        results["short"] = {"error": str(e)}

    shutil.rmtree(tmp, ignore_errors=True)
    return {"output_dir": out_dir, "results": results}


@router.post("/run-step/{step}")
async def run_pipeline_step(step: str, topic: str = "Metamorphosis", summary: str = "Test run step-by-step"):
    """Run a single pipeline step and return the result."""
    from domain.story_generator import generate_story
    from domain.scene_generator import generate_scenes

    steps_config = {
        "story": {"fn": "story", "needs": []},
        "scenes": {"fn": "scenes", "needs": ["story"]},
        "images": {"fn": "images", "needs": ["story", "scenes"]},
        "voice": {"fn": "voice", "needs": ["story", "scenes"]},
        "subtitles": {"fn": "subtitles", "needs": ["story", "scenes"]},
        "thumbnail": {"fn": "thumbnail", "needs": ["story"]},
        "video": {"fn": "video", "needs": ["story", "scenes", "images", "voice", "subtitles"]},
        "shorts": {"fn": "shorts", "needs": ["story", "scenes", "images"]},
    }

    if step not in steps_config:
        return {"error": f"Unknown step '{step}'. Options: {list(steps_config.keys())}"}

    # Build prerequisites
    story = None
    scenes = None
    project_dir = f"/tmp/debug_pipeline/{topic.replace(' ', '_')}"
    os.makedirs(project_dir, exist_ok=True)

    async def fake_progress(stage, pct):
        pass  # no-op for debug

    try:
        if step == "story":
            story = generate_story(topic, summary, "narrative")
            return {
                "step": "story",
                "ok": True,
                "title": story["title"],
                "sections": len(story["sections"]),
                "total_duration_s": story["total_duration_seconds"],
            }

        story = generate_story(topic, summary, "narrative")

        if step == "scenes":
            scenes = generate_scenes(story, 8)
            return {
                "step": "scenes",
                "ok": True,
                "count": len(scenes),
                "scenes": [{"n": s["scene_number"], "title": s["title"], "dur": s["duration_seconds"]} for s in scenes],
            }

        scenes = generate_scenes(story, 8)

        if step == "images":
            from domain.image_generator import generate_scene_images
            images_dir = os.path.join(project_dir, "images")
            os.makedirs(images_dir, exist_ok=True)
            image_results = await generate_scene_images(scenes, project_dir, fake_progress)
            return {
                "step": "images",
                "ok": True,
                "count": len(image_results),
                "results": [{
                    "scene": r["scene"],
                    "cached": r.get("cached", False),
                    "placeholder": r.get("placeholder", False),
                    "failed": r.get("failed", False),
                    "path": r.get("path"),
                    "exists": r.get("path") and os.path.exists(r["path"]),
                } for r in image_results],
            }

        if step == "voice":
            from domain.voice_generator import generate_voice
            voice_path = await generate_voice(scenes, project_dir, "neutral", fake_progress)
            exists = voice_path and os.path.exists(voice_path) if voice_path else False
            size = os.path.getsize(voice_path) if exists else 0
            return {
                "step": "voice",
                "ok": bool(exists and size > 500),
                "path": voice_path,
                "bytes": size,
            }

        if step == "subtitles":
            from domain.subtitle_generator import generate_subtitles
            subtitle_paths = await generate_subtitles(scenes, project_dir, fake_progress)
            return {
                "step": "subtitles",
                "ok": bool(subtitle_paths and subtitle_paths.get("srt")),
                "paths": subtitle_paths,
                "files_exist": {k: os.path.exists(v) for k, v in (subtitle_paths or {}).items()},
            }

        if step == "thumbnail":
            from domain.thumbnail_generator import generate_thumbnail
            thumb_path = await generate_thumbnail(story, project_dir, fake_progress)
            exists = thumb_path and os.path.exists(thumb_path) if thumb_path else False
            size = os.path.getsize(thumb_path) if exists else 0
            return {
                "step": "thumbnail",
                "ok": bool(exists and size > 500),
                "path": thumb_path,
                "bytes": size,
            }

        if step == "video":
            from domain.image_generator import generate_scene_images
            from domain.voice_generator import generate_voice
            from domain.subtitle_generator import generate_subtitles
            from domain.video_generator import render_video

            image_results = await generate_scene_images(scenes, project_dir, fake_progress)
            voice_path = await generate_voice(scenes, project_dir, "neutral", fake_progress)
            subtitle_paths = await generate_subtitles(scenes, project_dir, fake_progress)
            video_path = await render_video(scenes, image_results, voice_path, subtitle_paths, project_dir, fake_progress)
            exists = video_path and os.path.exists(video_path) if video_path else False
            size = os.path.getsize(video_path) if exists else 0
            return {
                "step": "video",
                "ok": bool(exists and size > 1000),
                "path": video_path,
                "bytes": size,
                "prerequisites": {
                    "images": len(image_results),
                    "voice_exists": bool(voice_path and os.path.exists(voice_path)),
                    "subs_exists": bool(subtitle_paths and subtitle_paths.get("srt") and os.path.exists(subtitle_paths["srt"])),
                },
            }

        if step == "shorts":
            from domain.image_generator import generate_scene_images
            from domain.video_generator import generate_shorts

            image_results = await generate_scene_images(scenes, project_dir, fake_progress)
            short_path = await generate_shorts(scenes, image_results, project_dir, fake_progress)
            exists = short_path and os.path.exists(short_path) if short_path else False
            size = os.path.getsize(short_path) if exists else 0
            return {
                "step": "shorts",
                "ok": bool(exists and size > 1000),
                "path": short_path,
                "bytes": size,
            }

    except Exception as e:
        return {"step": step, "ok": False, "error": str(e), "traceback": __import__("traceback").format_exc()}

    return {"error": f"Step {step} not implemented"}


class StoryInput(BaseModel):
    topic: str = "Metamorphosis"
    summary: str = "Test run step-by-step"

@router.post("/step1-story-scenes")
async def step1_story_scenes(input: StoryInput):
    """Step 1: Generate story + scenes (combined). Returns full result for frontend display."""
    from domain.story_generator import generate_story
    from domain.scene_generator import generate_scenes
    try:
        story = generate_story(input.topic, input.summary, "narrative")
        scenes = generate_scenes(story, 8)
        return {
            "ok": True,
            "story": {
                "title": story["title"],
                "topic": story.get("topic", input.topic),
                "sections": story.get("sections", story.get("content", [])),
                "total_duration_s": story.get("total_duration_seconds", 0),
                "style": story.get("style", "narrative"),
            },
            "scenes": [
                {
                    "number": s["scene_number"],
                    "title": s["title"],
                    "description": s.get("description", "")[:200],
                    "duration": s["duration_seconds"],
                    "image_prompt": s.get("image_prompt", ""),
                    "voice_text": s.get("narration", "Narrator: ..."),
                }
                for s in scenes
            ],
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "traceback": __import__("traceback").format_exc()}


@router.post("/step2-images")
async def step2_images(input: StoryInput):
    """Step 2: Generate story + scenes + images. Returns images as base64."""

    async def noop(stage, pct):
        pass

    from domain.story_generator import generate_story
    from domain.scene_generator import generate_scenes
    from domain.image_generator import generate_scene_images

    try:
        story = generate_story(input.topic, input.summary, "narrative")
        scenes = generate_scenes(story, 8)

        project_dir = f"/tmp/debug_pipeline/{input.topic.replace(' ', '_')}"

        image_results = await generate_scene_images(scenes, project_dir, noop)

        images = []
        for r in image_results:
            img_data = None
            if r.get("path") and os.path.exists(r["path"]):
                with open(r["path"], "rb") as f:
                    raw = f.read()
                    img_data = "data:image/png;base64," + base64.b64encode(raw).decode()
            failure = r.get("failed", False) or r.get("placeholder", False)
            images.append({
                "scene": r["scene"],
                "cached": r.get("cached", False),
                "placeholder": r.get("placeholder", False),
                "failed": r.get("failed", False),
                "prompt": r.get("prompt", ""),
                "image": img_data,
            })

        return {
            "ok": True,
            "images": images,
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "traceback": __import__("traceback").format_exc()}
