import os


def _format_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _format_vtt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def _format_txt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


async def generate_subtitles(scenes: list, project_dir: str, progress_callback=None) -> dict:
    subs_dir = os.path.join(project_dir, "subtitles")
    os.makedirs(subs_dir, exist_ok=True)

    srt_lines = []
    vtt_lines = ["WEBVTT", ""]
    txt_lines = []

    current_time = 0.0
    total = len(scenes)

    for i, scene in enumerate(scenes):
        duration = scene.get("duration_seconds", 10)
        text = scene.get("subtitle", scene.get("title", ""))
        if not text:
            narration = scene.get("narration", "")
            words = narration.split()
            text = " ".join(words[:20]) if words else scene.get("title", f"Scene {i + 1}")

        mid_time = current_time + duration / 2
        end_time = current_time + duration

        srt_lines.append(str(i + 1))
        srt_lines.append(f"{_format_srt_time(current_time)} --> {_format_srt_time(end_time)}")
        srt_lines.append(text)
        srt_lines.append("")

        vtt_lines.append(f"{_format_vtt_time(current_time)} --> {_format_vtt_time(end_time)}")
        vtt_lines.append(text)
        vtt_lines.append("")

        txt_lines.append(f"[{_format_txt_time(current_time)}] {text}")

        current_time = end_time

        if progress_callback:
            await progress_callback("GENERATING_SUBTITLES", int((i + 1) / total * 100))

    srt_path = os.path.join(subs_dir, "subtitles.srt")
    vtt_path = os.path.join(subs_dir, "subtitles.vtt")
    txt_path = os.path.join(subs_dir, "subtitles.txt")

    with open(srt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_lines))
    with open(vtt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(vtt_lines))
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(txt_lines))

    return {"srt": srt_path, "vtt": vtt_path, "txt": txt_path}
