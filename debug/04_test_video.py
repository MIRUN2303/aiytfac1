"""Step 4: Test FFmpeg video assembly independently.
Run after 01+02+03 have generated images and voice file."""
import sys, os, subprocess, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

def main():
    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 60)
    print("Testing FFmpeg Video Assembly")
    print("=" * 60)

    # Check ffmpeg
    try:
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=10)
        first_line = r.stdout.split("\n")[0] if r.stdout else "?"
        print(f"FFmpeg: {first_line}")
    except FileNotFoundError:
        print("ERROR: ffmpeg not found on PATH")
        return

    # Create test images (1920x1080 colored frames)
    print("\nCreating test frames...")
    frames_dir = os.path.join(output_dir, "frames")
    os.makedirs(frames_dir, exist_ok=True)

    try:
        from PIL import Image
    except ImportError:
        print("ERROR: PIL not installed")
        return

    num_frames = 5
    for i in range(num_frames):
        img = Image.new("RGB", (1920, 1080), (30 + i * 50, 20, 80 + i * 30))
        from PIL import ImageDraw
        draw = ImageDraw.Draw(img)
        draw.text((100, 500), f"Test Frame {i + 1}", fill=(255, 255, 255))
        img.save(os.path.join(frames_dir, f"frame_{i:04d}.png"))

    print(f"Created {num_frames} test frames")

    # Create concat file
    temp_dir = tempfile.mkdtemp()
    for f in os.listdir(frames_dir):
        import shutil
        shutil.copy2(os.path.join(frames_dir, f), os.path.join(temp_dir, f))

    concat_file = os.path.join(temp_dir, "concat.txt")
    with open(concat_file, "w") as f:
        for i in range(num_frames):
            f.write(f"file 'frame_{i:04d}.png'\n")
            f.write("duration 3\n")
        f.write(f"file 'frame_{num_frames-1:04d}.png'\n")

    # Test 1: Video without audio
    output1 = os.path.join(output_dir, "test_no_audio.mp4")
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-preset", "medium", "-crf", "23",
        "-vf", "scale=1920:1080,setsar=1",
        "-r", "24", "-an", output1,
    ]
    print(f"\n--- Test 1: No audio ---")
    print(f"Command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode == 0 and os.path.exists(output1) and os.path.getsize(output1) > 1000:
        print(f"SUCCESS: {os.path.getsize(output1)} bytes -> {output1}")
    else:
        print(f"FAILED (rc={result.returncode}): {result.stderr[:500]}")
        print(f"STDOUT: {result.stdout[:300]}")

    # Test 2: Video with audio (if voice file exists)
    voice_path = os.path.join(output_dir, "test_en_US_JennyNeural.wav")
    if os.path.exists(voice_path) and os.path.getsize(voice_path) > 500:
        output2 = os.path.join(output_dir, "test_with_audio.mp4")
        cmd2 = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", concat_file,
            "-i", voice_path,
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-preset", "medium", "-crf", "23",
            "-vf", "scale=1920:1080,setsar=1",
            "-r", "24", "-c:a", "aac", "-b:a", "192k", "-shortest", output2,
        ]
        print(f"\n--- Test 2: With audio ---")
        result2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=120)
        if result2.returncode == 0 and os.path.exists(output2) and os.path.getsize(output2) > 1000:
            print(f"SUCCESS: {os.path.getsize(output2)} bytes -> {output2}")
        else:
            print(f"FAILED: {result2.stderr[:500]}")

    # Test 3: Video with subtitles
    srt_path = os.path.join(output_dir, "test.srt")
    with open(srt_path, "w") as f:
        f.write("1\n00:00:01,000 --> 00:00:04,000\nTest subtitle line 1\n\n")
        f.write("2\n00:00:05,000 --> 00:00:08,000\nTest subtitle line 2\n\n")

    output3 = os.path.join(output_dir, "test_subtitles.mp4")
    srt_escaped = srt_path.replace("\\", "/").replace(":", "\\:")
    cmd3 = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-preset", "medium", "-crf", "23",
        "-vf", f"scale=1920:1080,setsar=1,subtitles={srt_escaped}",
        "-r", "24", "-an", output3,
    ]
    print(f"\n--- Test 3: With subtitles ---")
    print(f"SRT path: {srt_path}")
    print(f"Escaped: {srt_escaped}")
    result3 = subprocess.run(cmd3, capture_output=True, text=True, timeout=120)
    if result3.returncode == 0 and os.path.exists(output3) and os.path.getsize(output3) > 1000:
        print(f"SUCCESS: {os.path.getsize(output3)} bytes -> {output3}")
    else:
        print(f"FAILED: {result3.stderr[:500]}")

    # Test 4: Fix shorts - vertical 9:16
    print(f"\n--- Test 4: Short (9:16 vertical) ---")
    img_short = os.path.join(output_dir, "short_frame.png")
    # Crop center 1080:1920 from 1920x1080
    img_full = Image.new("RGB", (1920, 1080), (40, 60, 120))
    target_w, target_h = 1080, 1920
    src_w, src_h = img_full.size
    src_aspect = src_w / src_h
    target_aspect = target_w / target_h
    if src_aspect > target_aspect:
        new_w = int(src_h * target_aspect)
        offset = (src_w - new_w) // 2
        cropped = img_full.crop((offset, 0, offset + new_w, src_h))
    else:
        new_h = int(src_w / target_aspect)
        offset = (src_h - new_h) // 2
        cropped = img_full.crop((0, offset, src_w, offset + new_h))
    cropped = cropped.resize((target_w, target_h), Image.LANCZOS)
    cropped.save(img_short)

    short_dir = tempfile.mkdtemp()
    import shutil
    shutil.copy2(img_short, os.path.join(short_dir, "cropped.png"))
    sc = os.path.join(short_dir, "short_concat.txt")
    with open(sc, "w") as f:
        f.write("file 'cropped.png'\nduration 5\nfile 'cropped.png'\n")
    output4 = os.path.join(output_dir, "test_short.mp4")
    cmd4 = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0",
        "-i", sc,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-preset", "medium", "-crf", "23",
        "-vf", f"scale={target_w}:{target_h}",
        "-an", output4,
    ]
    result4 = subprocess.run(cmd4, capture_output=True, text=True, timeout=120)
    if result4.returncode == 0 and os.path.exists(output4) and os.path.getsize(output4) > 1000:
        print(f"SUCCESS: {os.path.getsize(output4)} bytes -> {output4}")
    else:
        print(f"FAILED: {result4.stderr[:300]}")

    shutil.rmtree(short_dir)
    shutil.rmtree(temp_dir)
    print("\nDONE")

if __name__ == "__main__":
    main()
