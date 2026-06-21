import pytest
from httpx import AsyncClient, ASGITransport
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__))))


@pytest.mark.asyncio
async def test_story_generation():
    from domain.story_generator import generate_story
    story = generate_story("Artificial Intelligence", "A deep dive into AI", "narrative")
    assert story["title"] is not None
    assert len(story["title"]) > 0
    assert "topic" in story
    assert "sections" in story
    assert len(story["sections"]) > 0
    assert story["total_duration_seconds"] > 0
    assert len(story["keywords"]) > 0
    assert len(story["tags"]) > 0
    assert len(story["hashtags"]) > 0


@pytest.mark.asyncio
async def test_story_styles():
    from domain.story_generator import generate_story, STORY_TEMPLATES
    for style in STORY_TEMPLATES:
        story = generate_story("Test", "Test summary", style)
        assert story["style"] == style
        assert len(story["sections"]) > 0


@pytest.mark.asyncio
async def test_scene_generation():
    from domain.story_generator import generate_story
    from domain.scene_generator import generate_scenes

    story = generate_story("Space Exploration", "Exploring the cosmos", "documentary")
    scenes = generate_scenes(story, duration_minutes=5)
    assert len(scenes) > 0
    for scene in scenes:
        assert "scene_number" in scene
        assert "narration" in scene
        assert "duration_seconds" in scene
        assert "camera_style" in scene
        assert "image_prompt" in scene
        assert "transition" in scene
        assert scene["duration_seconds"] >= 2


@pytest.mark.asyncio
async def test_subtitle_generation(tmp_path):
    from domain.subtitle_generator import generate_subtitles
    scenes = [
        {"title": "Intro", "subtitle": "Welcome to the video", "duration_seconds": 5},
        {"title": "Main", "subtitle": "This is the main content", "duration_seconds": 10},
        {"title": "Ending", "subtitle": "Thanks for watching", "duration_seconds": 5},
    ]
    result = await generate_subtitles(scenes, str(tmp_path))
    assert "srt" in result
    assert "vtt" in result
    assert "txt" in result
    assert os.path.exists(result["srt"])
    assert os.path.exists(result["vtt"])
    assert os.path.exists(result["txt"])

    with open(result["srt"], "r", encoding="utf-8") as f:
        content = f.read()
        assert "WEBVTT" not in content
        assert "1" in content


@pytest.mark.asyncio
async def test_metadata_generation(tmp_path):
    from domain.metadata_generator import generate_metadata
    story = {
        "title": "Test Video",
        "seo_description": "A test video description",
        "keywords": ["test", "video"],
        "tags": ["Test", "Video"],
        "hashtags": ["#Test"],
        "video_category": "Education",
        "pinned_comment": "Great video!",
        "thumbnail_text": "Test Video!",
    }
    metadata = generate_metadata(story, str(tmp_path))
    assert metadata["title"] == "Test Video"
    assert "seo_data" in metadata
    assert "upload_config" in metadata
    assert os.path.exists(os.path.join(str(tmp_path), "metadata", "metadata.json"))


@pytest.mark.asyncio
async def test_voice_generation(tmp_path):
    from domain.voice_generator import generate_voice
    scenes = [
        {"title": "Scene 1", "narration": "Hello and welcome.", "duration_seconds": 5},
        {"title": "Scene 2", "narration": "This is the content.", "duration_seconds": 5},
    ]
    result = await generate_voice(scenes, str(tmp_path), "neutral")
    assert result is not None
    assert os.path.exists(result) or os.path.exists(os.path.join(str(tmp_path), "voice", "script.txt"))


@pytest.mark.asyncio
async def test_thumbnail_generation(tmp_path):
    from domain.thumbnail_generator import generate_thumbnail
    story = {
        "title": "Test Video",
        "thumbnail_text": "Amazing Test Video!",
        "topic": "Test",
    }
    result = await generate_thumbnail(story, str(tmp_path))
    assert result is not None


@pytest.mark.asyncio
async def test_hf_image_client():
    from infrastructure.hf_image_client import generate_image
    result = await generate_image("a simple test pattern", retries=1, delay=0.5)
    if result:
        assert len(result) > 0


@pytest.mark.asyncio
async def test_upload_service():
    from infrastructure.upload_service import upload_to_youtube, prepare_upload_metadata
    from database import init_db
    import tempfile
    import os

    await init_db()

    tmp = tempfile.mkdtemp()
    test_video = os.path.join(tmp, "test.mp4")
    with open(test_video, "w") as f:
        f.write("fake video content")

    result = await upload_to_youtube(
        project_id=999,
        video_path=test_video,
        title="Test Upload",
        description="Test",
        tags=["test"],
    )
    assert result["success"] is True
    assert result["video_id"] is not None

    metadata = prepare_upload_metadata({
        "title": "Test", "description": "Desc",
        "tags": ["a"], "category": "Education",
        "visibility": "public", "made_for_kids": False,
    })
    assert metadata["title"] == "Test"


@pytest.mark.asyncio
async def test_domain_image_generator(tmp_path):
    from domain.image_generator import _generate_placeholder_image
    path = os.path.join(str(tmp_path), "test_placeholder.png")
    result = _generate_placeholder_image(path, 1, "test prompt")
    assert result
    assert os.path.exists(path)


@pytest.mark.asyncio
async def test_scheduler_cron_parsing():
    from infrastructure.scheduler_service import parse_cron_minutes, calculate_next_run
    assert parse_cron_minutes("*/30 * * * *") == 30
    assert parse_cron_minutes("* * * * *") == 1
    assert calculate_next_run("*/60 * * * *") is not None
