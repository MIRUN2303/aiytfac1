import random

CAMERA_STYLES = [
    "wide shot", "close up", "aerial view", "tracking shot",
    "dutch angle", "bird's eye view", "low angle shot", "over the shoulder",
    "POV shot", "dolly zoom", "crane shot", "steady cam",
    "macro shot", "extreme wide", "medium shot", "two shot",
]

TRANSITIONS = [
    "crossfade", "fade to black", "dissolve", "slide left",
    "blur in", "zoom transition", "wipe right", "push up",
    "clock wipe", "page peel", "radial wipe", "random bars",
]

MUSIC_MOODS = [
    "epic orchestral", "mysterious ambient", "dramatic cinematic",
    "melancholic piano", "intense percussion", "hopeful strings",
    "suspenseful synth", "uplifting electronic", "dark atmospheric",
    "triumphant brass", "emotional piano", "quirky whimsical",
]

EMOTIONS = [
    "neutral", "intense", "mysterious", "dramatic",
    "happy", "sad", "suspenseful", "reflective",
    "awe inspiring", "tense", "hopeful", "nostalgic",
]

MOVEMENT_STYLES = [
    "slow pan right", "slow pan left", "gentle zoom in", "gentle zoom out",
    "Ken Burns effect", "tracking right", "tracking left",
    "parallax scroll", "static shot", "push in",
    "pull out", "crane up", "crane down", "dolly in",
    "dolly out", "orbit around subject",
]

SOUND_EFFECTS = [
    "none", "ambient wind", "soft whoosh", "deep rumble",
    "birds chirping", "rain falling", "heartbeat", "sharp impact",
    "gentle chime", "distant thunder", "water flowing", "crackling fire",
]

ANIMATION_PROMPTS = [
    "Ken Burns slow zoom in",
    "Ken Burns slow zoom out",
    "gentle pan across scene",
    "parallax depth effect",
    "dolly zoom effect",
    "static with subtle shake",
    "slow pull back",
    "dynamic tracking",
    "push in with motion blur",
    "orbit rotation",
]


def _generate_image_prompt(scene_num: int, title: str, topic: str, camera: str, total_scenes: int) -> str:
    style_adj = random.choice([
        "cinematic", "dramatic", "realistic", "atmospheric",
        "epic", "moody", "vibrant", "mysterious",
        "photorealistic", "stunning", "breathtaking", "award winning",
    ])
    lighting = random.choice([
        "cinematic lighting", "golden hour", "dramatic shadows",
        "soft diffused light", "rim lighting", "volumetric lighting",
        "moody low key", "bright natural light",
    ])
    quality = random.choice([
        "ultra detailed, 8K, sharp focus",
        "highly detailed, 4K, professional composition",
        "masterpiece, intricate details, perfect composition",
    ])
    return (
        f"{topic}, {title}, {style_adj} scene, {camera}, "
        f"{lighting}, {quality}, no text, no watermark, no logo"
    )


def generate_scenes(story: dict, duration_minutes: int = 8) -> list:
    sections = story.get("sections", [])
    if not sections:
        return []

    total_sections = len(sections)
    target_seconds = duration_minutes * 60
    per_section = max(20, target_seconds // total_sections) if total_sections else 45

    scenes = []
    for i, section in enumerate(sections):
        style_idx = i % len(CAMERA_STYLES)
        trans_idx = i % len(TRANSITIONS)
        music_idx = i % len(MUSIC_MOODS)
        emotion_idx = min(i % len(EMOTIONS), len(EMOTIONS) - 1)
        movement_idx = i % len(MOVEMENT_STYLES)
        sfx_idx = i % len(SOUND_EFFECTS)
        anim_idx = i % len(ANIMATION_PROMPTS)

        camera = CAMERA_STYLES[style_idx]
        emotion = EMOTIONS[emotion_idx]

        explicit_title = section.get("title", f"Scene {i + 1}")
        content = section.get("content", "")
        narration = f"{explicit_title}. {content}"

        subtitle_words = narration.split()
        subtitle = " ".join(subtitle_words[:30]) + ("..." if len(subtitle_words) > 30 else "")

        topic = story.get("topic", "Scene")
        image_prompt = _generate_image_prompt(i + 1, explicit_title, topic, camera, total_sections)

        scenes.append({
            "scene_number": i + 1,
            "title": explicit_title,
            "narration": narration,
            "duration_seconds": per_section,
            "emotion": emotion,
            "camera_style": camera,
            "image_prompt": image_prompt,
            "animation_prompt": ANIMATION_PROMPTS[anim_idx],
            "subtitle": subtitle,
            "music_mood": MUSIC_MOODS[music_idx],
            "sound_effect": SOUND_EFFECTS[sfx_idx],
            "transition": TRANSITIONS[trans_idx],
            "timestamp_seconds": i * per_section,
            "movement_style": MOVEMENT_STYLES[movement_idx],
        })

    return scenes
