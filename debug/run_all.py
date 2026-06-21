"""
Debug Runner -- run each pipeline step independently with detailed output.
Usage: $env:HF_TOKEN='your_token'; python debug/run_all.py
"""
import sys, os, json, asyncio, subprocess, tempfile, traceback

DEBUG_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(DEBUG_DIR)
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
OUTPUT_DIR = os.path.join(DEBUG_DIR, "output")
sys.path.insert(0, BACKEND_DIR)
os.makedirs(OUTPUT_DIR, exist_ok=True)

TOPIC = "Metamorphosis"
SUMMARY = "The classic story of transformation."

PASS = 0
FAIL = 0

def heading(n, title):
    print(f"\n{'=' * 60}")
    print(f"  STEP {n}: {title}")
    print(f"{'=' * 60}")

def ok(msg):
    global PASS; PASS += 1
    print(f"  OK  {msg}")

def fail(msg, detail=""):
    global FAIL; FAIL += 1
    print(f"  FAIL  {msg}")
    if detail:
        for line in detail.strip().split("\n"):
            print(f"       {line}")

def check_file(path, min_bytes=1):
    if not os.path.exists(path):
        return False, "File does not exist"
    size = os.path.getsize(path)
    if size < min_bytes:
        return False, f"File too small: {size} bytes (min {min_bytes})"
    return True, f"{size} bytes"

# ============================================================
print(f"\n{'=' * 54}")
print(f"  AI YouTube Factory -- Pipeline Debugger")
print(f"  Topic:  {TOPIC}")
print(f"  Output: {OUTPUT_DIR}")
print(f"{'=' * 54}\n")

# ============================================================
# STEP 1: Story & Scene Generation
# ============================================================
heading(1, "Story & Scene Generation")
try:
    from domain.story_generator import generate_story
    from domain.scene_generator import generate_scenes

    story = generate_story(TOPIC, SUMMARY, "narrative")
    assert len(story["sections"]) > 0, "No sections in story"
    ok(f"Story generated: {story['title']} ({story['total_duration_seconds']}s, {len(story['sections'])} sections)")

    scenes = generate_scenes(story, 8)
    assert len(scenes) > 0, "No scenes generated"
    ok(f"Scenes generated: {len(scenes)} scenes")
except Exception as e:
    fail("Story/Scene generation", traceback.format_exc())
    sys.exit(1)

# ============================================================
# STEP 2: Environment checks
# ============================================================
heading(2, "Environment Checks")

# FFmpeg
ffmpeg_ok = False
try:
    r = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=10)
    v = r.stdout.split("\n")[0] if r.stdout else "?"
    ok(f"FFmpeg: {v}")
    ffmpeg_ok = True
except FileNotFoundError:
    fail("FFmpeg not found on PATH")
except Exception as e:
    fail("FFmpeg check", str(e))

# Pillow
try:
    from PIL import Image, ImageDraw, ImageFont
    ok("Pillow installed")
except ImportError:
    fail("Pillow not installed")

# edge-tts
try:
    import edge_tts
    ok("edge-tts installed")
except ImportError:
    fail("edge-tts not installed (pip install edge-tts)")

# HF token
token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACEHUB_API_TOKEN")
if token:
    ok(f"HF token found: {token[:8]}...{token[-4:]} ({len(token)} chars)")
else:
    fail("No HF_TOKEN or HUGGINGFACEHUB_API_TOKEN set")

# httpx
try:
    import httpx
    ok("httpx installed")
except ImportError:
    fail("httpx not installed")

# ============================================================
# STEP 3: HF Image Generation
# ============================================================
heading(3, "HF Image Generation")
sys.path.insert(0, BACKEND_DIR)
from infrastructure.hf_image_client import generate_image

prompt = "A butterfly emerging from a cocoon, cinematic lighting, ultra detailed, photorealistic"
any_image_ok = False

models_to_try = [
    "runwayml/stable-diffusion-v1-5",
    "stabilityai/stable-diffusion-2-1",
    "prompthero/openjourney-v4",
]

for model in models_to_try:
    if any_image_ok:
        break
    try:
        data = asyncio.run(generate_image(prompt, seed=42, model=model))
        if data and len(data) > 500:
            fn = os.path.join(OUTPUT_DIR, f"img_{model.split('/')[-1]}.png")
            with open(fn, "wb") as f:
                f.write(data)
            ok(f"Model {model}: {len(data)} bytes -> {fn}")
            any_image_ok = True
        else:
            sz = len(data) if data else 0
            fail(f"Model {model}: response {sz} bytes (need >500)")
    except Exception as e:
        fail(f"Model {model}: {e}")

if not any_image_ok:
    print("\n  --- Trying default chain (3 models, 3 retries each) ---")
    try:
        data = asyncio.run(generate_image(prompt, seed=42))
        if data and len(data) > 500:
            fn = os.path.join(OUTPUT_DIR, "img_default.png")
            with open(fn, "wb") as f:
                f.write(data)
            ok(f"Default chain: {len(data)} bytes")
            any_image_ok = True
        else:
            sz = len(data) if data else 0
            fail(f"Default chain: response {sz} bytes")
    except Exception as e:
        fail("Default chain", str(e))

if not any_image_ok:
    fail("ALL image models failed -- check HF_TOKEN and model availability")
    print("\n  Models may need you to accept terms at huggingface.co/runwayml/stable-diffusion-v1-5")
    print("  Also try: stabilityai/stable-diffusion-2-1, prompthero/openjourney-v4")

# ============================================================
# STEP 4: Voice Generation
# ============================================================
heading(4, "Voice Generation (edge-tts)")
try:
    import edge_tts
    text = "This is a test of voice generation. This text will be spoken by the neural network. " * 5

    for voice in ["en-US-JennyNeural", "en-US-GuyNeural"]:
        mp3 = os.path.join(OUTPUT_DIR, f"voice_{voice.replace('-', '_')}.mp3")
        try:
            asyncio.run(edge_tts.Communicate(text, voice).save(mp3))
            sz_good, sz_msg = check_file(mp3, 500)
            if sz_good:
                ok(f"Edge-TTS {voice}: {sz_msg}")

                # convert to WAV
                wav = mp3.replace(".mp3", ".wav")
                r = subprocess.run(
                    ["ffmpeg", "-y", "-i", mp3, "-acodec", "pcm_s16le",
                     "-ar", "22050", "-ac", "1", wav],
                    capture_output=True, text=True, timeout=60,
                )
                if r.returncode == 0:
                    wav_sz = os.path.getsize(wav) if os.path.exists(wav) else 0
                    ok(f"WAV converted: {wav_sz} bytes")
                else:
                    fail(f"WAV conversion: {r.stderr[:200]}")
                try:
                    os.remove(mp3)
                except OSError:
                    pass
            else:
                fail(f"Edge-TTS {voice}: {sz_msg}")
        except Exception as e:
            fail(f"Voice {voice}: {e}")
except ImportError:
    fail("edge-tts not available, skipping voice test")

# ============================================================
# STEP 5: Full FFmpeg Video Assembly
# ============================================================
heading(5, "FFmpeg Video Assembly")

# Create test frames
frames_dir = None
try:
    from PIL import Image, ImageDraw
    frames_dir = os.path.join(OUTPUT_DIR, "test_frames")
    os.makedirs(frames_dir, exist_ok=True)
    for i in range(5):
        img = Image.new("RGB", (1920, 1080), (20 + i * 50, 30, 80 + i * 20))
        d = ImageDraw.Draw(img)
        d.text((100, 500), f"Test Frame {i+1}", fill=(255, 255, 255))
        img.save(os.path.join(frames_dir, f"frame_{i:04d}.png"))
    ok("5 test frames created (1920x1080)")
except Exception as e:
    fail("Creating test frames", str(e))

if frames_dir and ffmpeg_ok:
    tmp = tempfile.mkdtemp()
    import shutil
    for f in os.listdir(frames_dir):
        shutil.copy2(os.path.join(frames_dir, f), os.path.join(tmp, f))

    # concat file
    cf = os.path.join(tmp, "concat.txt")
    with open(cf, "w") as f:
        for i in range(5):
            f.write(f"file 'frame_{i:04d}.png'\nduration 3\n")
        f.write("file 'frame_0004.png'\n")

    # Test 5a: no audio
    out_na = os.path.join(OUTPUT_DIR, "video_no_audio.mp4")
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", cf,
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "23",
           "-vf", "scale=1920:1080,setsar=1", "-r", "24", "-an", out_na]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if r.returncode == 0:
            sz = os.path.getsize(out_na) if os.path.exists(out_na) else 0
            ok(f"Video (no audio): {sz} bytes")
        else:
            fail("Video (no audio)", r.stderr[:500])
    except Exception as e:
        fail("Video (no audio)", str(e))

    # Test 5b: with audio
    voice_wav = os.path.join(OUTPUT_DIR, "voice_en_US_JennyNeural.wav")
    if os.path.exists(voice_wav):
        out_wa = os.path.join(OUTPUT_DIR, "video_with_audio.mp4")
        cmd2 = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", cf,
                "-i", voice_wav,
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "23",
                "-vf", "scale=1920:1080,setsar=1", "-r", "24",
                "-c:a", "aac", "-b:a", "192k", "-shortest", out_wa]
        try:
            r2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=120)
            if r2.returncode == 0:
                sz = os.path.getsize(out_wa) if os.path.exists(out_wa) else 0
                ok(f"Video (with audio): {sz} bytes")
            else:
                fail("Video (with audio)", r2.stderr[:300])
        except Exception as e:
            fail("Video (with audio)", str(e))
    else:
        fail("Skipping audio test -- no WAV file from step 4")

    # Test 5c: with subtitles
    srt = os.path.join(OUTPUT_DIR, "test.srt")
    with open(srt, "w") as f:
        f.write("1\n00:00:01,000 --> 00:00:04,000\nLine 1\n\n2\n00:00:05,000 --> 00:00:08,000\nLine 2\n\n")
    out_srt = os.path.join(OUTPUT_DIR, "video_with_subs.mp4")
    srt_e = srt.replace("\\", "/").replace(":", "\\:")
    # wrap path in quotes to handle spaces
    cmd3 = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", cf,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "23",
            "-vf", f"scale=1920:1080,setsar=1,subtitles='{srt_e}'",
            "-r", "24", "-an", out_srt]
    try:
        r3 = subprocess.run(cmd3, capture_output=True, text=True, timeout=120)
        if r3.returncode == 0:
            sz = os.path.getsize(out_srt) if os.path.exists(out_srt) else 0
            ok(f"Video (subtitles): {sz} bytes")
        else:
            fail("Video (subtitles)", r3.stderr[-600:])
    except Exception as e:
        fail("Video (subtitles)", str(e))

    shutil.rmtree(tmp)
else:
    fail("Skipping video assembly tests (missing frames or ffmpeg)")

# ============================================================
# STEP 6: Shorts Generation
# ============================================================
heading(6, "Shorts Generation (9:16 vertical)")
try:
    from PIL import Image
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
    crop_path = os.path.join(OUTPUT_DIR, "short_frame_vertical.png")
    cropped.save(crop_path)
    ok(f"Short frame cropped to {target_w}x{target_h}")

    if ffmpeg_ok:
        short_dir = tempfile.mkdtemp()
        import shutil
        shutil.copy2(crop_path, os.path.join(short_dir, "cropped.png"))
        sc = os.path.join(short_dir, "short_concat.txt")
        with open(sc, "w") as f:
            f.write("file 'cropped.png'\nduration 5\nfile 'cropped.png'\n")
        out_short = os.path.join(OUTPUT_DIR, "short_test.mp4")
        cmd_short = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", sc,
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-preset", "medium", "-crf", "23",
            "-vf", f"scale={target_w}:{target_h}",
            "-an", out_short,
        ]
        try:
            r = subprocess.run(cmd_short, capture_output=True, text=True, timeout=120)
            if r.returncode == 0:
                sz = os.path.getsize(out_short) if os.path.exists(out_short) else 0
                if sz > 5000:
                    ok(f"Short video: {sz} bytes")
                else:
                    fail(f"Short video too small: {sz} bytes")
            else:
                fail("Short FFmpeg", r.stderr[:200])
        except Exception as e:
            fail("Short FFmpeg", str(e))
        shutil.rmtree(short_dir)
except Exception as e:
    fail("Shorts generation", traceback.format_exc())

# ============================================================
# Summary
# ============================================================
total = PASS + FAIL
print(f"\n{'=' * 60}")
if FAIL == 0:
    print(f"  ALL {PASS}/{PASS} TESTS PASSED")
else:
    print(f"  {PASS}/{total} PASSED, {FAIL}/{total} FAILED")
print(f"{'=' * 60}")
print(f"\nOutput files in: {OUTPUT_DIR}")
print("Run each step individually:")
print(f"  python debug/01_test_story.py")
print(f"  python debug/02_test_hf_images.py")
print(f"  python debug/03_test_voice.py")
print(f"  python debug/04_test_video.py")
