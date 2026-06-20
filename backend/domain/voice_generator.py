import os
import subprocess
import logging
import math
import struct
import json
from typing import Optional

logger = logging.getLogger(__name__)


def _generate_wave_file(filepath: str, duration_seconds: float, sample_rate: int = 22050) -> str:
    try:
        import numpy as np
        t = np.linspace(0, duration_seconds, int(sample_rate * duration_seconds), endpoint=False)
        freq_carrier = 180.0
        freq_mod = 2.5
        mod_depth = 0.3

        signal = (1.0 - mod_depth) * np.sin(2 * np.pi * freq_carrier * t) + \
                 mod_depth * np.sin(2 * np.pi * (freq_carrier + freq_mod) * t) * \
                 np.sin(2 * np.pi * freq_carrier * t)

        envelope = 0.5 * (1.0 - np.cos(2 * np.pi * t / duration_seconds))
        signal = signal * envelope * 0.3

        samples = (signal * 32767).astype(np.int16)

        with open(filepath, "wb") as f:
            nchannels = 1
            sampwidth = 2
            framerate = sample_rate
            nframes = len(samples)
            comptype = "NONE"
            compname = "not compressed"

            f.write(b"RIFF")
            f.write(struct.pack("<I", 36 + sampwidth * nframes))
            f.write(b"WAVE")
            f.write(b"fmt ")
            f.write(struct.pack("<IHHIIHH", 16, 1, nchannels, framerate,
                                sampwidth * framerate * nchannels,
                                sampwidth * nchannels, sampwidth * 8))
            f.write(b"data")
            f.write(struct.pack("<I", sampwidth * nframes))
            f.write(samples.tobytes())

        logger.info(f"Generated WAV file: {filepath} ({duration_seconds}s)")
        return filepath
    except ImportError:
        return _generate_wave_numpy(filepath, duration_seconds, sample_rate)


def _generate_wave_numpy(filepath: str, duration_seconds: float, sample_rate: int = 22050) -> str:
    try:
        nframes = int(sample_rate * duration_seconds)
        samples = bytearray()

        for i in range(nframes):
            t = i / sample_rate
            val = int(8000 * math.sin(2 * math.pi * 180 * t) + 3000 * math.sin(2 * math.pi * 2.5 * t))
            val = max(-32768, min(32767, val))
            samples.extend(struct.pack("<h", val))

        with open(filepath, "wb") as f:
            nchannels = 1
            sampwidth = 2
            framerate = sample_rate
            nframes = len(samples) // sampwidth

            f.write(b"RIFF")
            f.write(struct.pack("<I", 36 + len(samples)))
            f.write(b"WAVE")
            f.write(b"fmt ")
            f.write(struct.pack("<IHHIIHH", 16, 1, nchannels, framerate,
                                sampwidth * framerate * nchannels,
                                sampwidth * nchannels, sampwidth * 8))
            f.write(b"data")
            f.write(struct.pack("<I", len(samples)))
            f.write(bytes(samples))

        logger.info(f"Generated WAV (numpy fallback): {filepath}")
        return filepath
    except Exception as e:
        logger.error(f"Failed to generate WAV: {e}")
        return filepath


async def _try_piper_tts(script_text: str, output_path: str, voice_style: str) -> Optional[str]:
    try:
        piper_path = os.environ.get("PIPER_PATH", "piper")
        voice_model = os.environ.get(
            "PIPER_VOICE",
            os.path.join(os.path.dirname(__file__), "..", "..", "models", "voice", "en_US-hfc_male-medium.onnx")
        )

        if not os.path.exists(voice_model):
            logger.warning(f"Piper voice model not found: {voice_model}")
            return None

        temp_txt = output_path.replace(".wav", "_piper_input.txt")
        with open(temp_txt, "w", encoding="utf-8") as f:
            f.write(script_text)

        cmd = [
            piper_path,
            "--model", voice_model,
            "--output_file", output_path,
        ]
        with open(temp_txt, "r") as f:
            result = subprocess.run(cmd, stdin=f, capture_output=True, text=True, timeout=120)

        os.remove(temp_txt)

        if result.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
            logger.info(f"Piper TTS generated: {output_path}")
            return output_path
        else:
            logger.warning(f"Piper failed: {result.stderr[:200]}")
            return None
    except FileNotFoundError:
        logger.warning("Piper executable not found")
        return None
    except subprocess.TimeoutExpired:
        logger.warning("Piper timed out")
        return None
    except Exception as e:
        logger.warning(f"Piper TTS error: {e}")
        return None


async def generate_voice(scenes: list, project_dir: str, voice_style: str = "neutral", progress_callback=None) -> str:
    voice_dir = os.path.join(project_dir, "voice")
    os.makedirs(voice_dir, exist_ok=True)
    output_path = os.path.join(voice_dir, "voice.wav")
    script_path = os.path.join(voice_dir, "script.txt")

    total_duration = sum(scene.get("duration_seconds", 10) for scene in scenes)
    script_lines = []

    for i, scene in enumerate(scenes):
        narration = scene.get("narration", "")
        script_lines.append(f"[Scene {i + 1}: {scene.get('title', '')}]")
        script_lines.append(narration)
        script_lines.append("")
        if progress_callback:
            await progress_callback("GENERATING_VOICE", int((i + 1) / len(scenes) * 100))

    script_text = "\n".join(script_lines)
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(script_text)

    piper_path = await _try_piper_tts(script_text, output_path, voice_style)
    if piper_path:
        if progress_callback:
            await progress_callback("GENERATING_VOICE", 100)
        return piper_path

    estimated_duration = total_duration
    _generate_wave_file(output_path, estimated_duration)

    timing_path = os.path.join(voice_dir, "timing.json")
    timing_data = {
        "total_duration_seconds": estimated_duration,
        "sample_rate": 22050,
        "channels": 1,
        "bits_per_sample": 16,
        "voice_style": voice_style,
        "generated_via": "waveform",
    }
    with open(timing_path, "w", encoding="utf-8") as f:
        json.dump(timing_data, f, indent=2)

    if progress_callback:
        await progress_callback("GENERATING_VOICE", 100)

    return output_path
