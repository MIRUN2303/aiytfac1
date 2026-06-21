"""Step 1: Generate story (template-only, no API needed)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from domain.story_generator import generate_story
from domain.scene_generator import generate_scenes

TOPIC = "Metamorphosis"
SUMMARY = "The classic story of transformation."

print("=" * 60)
print(f"TOPIC: {TOPIC}")
print(f"SUMMARY: {SUMMARY}")
print("=" * 60)

story = generate_story(TOPIC, SUMMARY, "narrative")
print(f"\nTitle: {story['title']}")
print(f"Duration: {story['total_duration_seconds']}s ({len(story['sections'])} sections)")
print(f"SEO: {story['seo_description'][:80]}...")
print("STORY OK")

scenes = generate_scenes(story, 8)
print(f"\nScenes generated: {len(scenes)}")
for s in scenes:
    print(f"  Scene {s['scene_number']}: {s['title']} ({s['duration_seconds']}s)")
    print(f"    Image prompt: {s['image_prompt'][:80]}...")
    print(f"    Narration: {s['narration'][:80]}...")
print("SCENES OK")
