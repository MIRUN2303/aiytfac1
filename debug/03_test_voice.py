"""Step 3: Test edge-tts voice generation."""
import sys, os, asyncio
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

async def main():
    output_dir = os.path.join(os.path.dirname(__file__), "output")
    os.makedirs(output_dir, exist_ok=True)

    text = "This is a test of the voice generation system. " * 3

    print("=" * 60)
    print("Testing Edge-TTS Voice Generation")
    print("=" * 60)

    # 1. check if edge-tts is installed
    try:
        import edge_tts
        print(f"\nedge-tts version: {edge_tts.__version__ if hasattr(edge_tts, '__version__') else 'installed'}")
    except ImportError:
        print("\nERROR: edge-tts not installed. Run: pip install edge-tts")
        return

    # 2. try voices
    voices_to_try = ["en-US-JennyNeural", "en-US-GuyNeural", "en-GB-SoniaNeural"]
    for voice in voices_to_try:
        print(f"\n--- Voice: {voice} ---")
        try:
            mp3_out = os.path.join(output_dir, f"test_{voice.replace('-', '_')}.mp3")
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(mp3_out)
            size = os.path.getsize(mp3_out) if os.path.exists(mp3_out) else 0
            if size > 500:
                print(f"SUCCESS: {size} bytes -> {mp3_out}")

                # 3. convert to WAV with FFmpeg
                wav_out = mp3_out.replace(".mp3", ".wav")
                import subprocess
                result = subprocess.run(
                    ["ffmpeg", "-y", "-i", mp3_out, "-acodec", "pcm_s16le",
                     "-ar", "22050", "-ac", "1", wav_out],
                    capture_output=True, text=True, timeout=60,
                )
                if result.returncode == 0 and os.path.exists(wav_out) and os.path.getsize(wav_out) > 500:
                    print(f"WAV OK: {os.path.getsize(wav_out)} bytes -> {wav_out}")
                else:
                    print(f"WAV FAILED: {result.stderr[:200]}")
                os.remove(mp3_out)
            else:
                print(f"FAILED: output {size} bytes")
        except Exception as e:
            print(f"ERROR: {e}")

    print("\nDONE")

if __name__ == "__main__":
    asyncio.run(main())
