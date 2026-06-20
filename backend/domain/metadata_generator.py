import json
import os


def generate_metadata(story: dict, project_dir: str) -> dict:
    meta = {
        "title": story.get("title", ""),
        "description": story.get("seo_description", ""),
        "keywords": story.get("keywords", []),
        "tags": story.get("tags", []),
        "hashtags": story.get("hashtags", []),
        "category": story.get("video_category", "Education"),
        "pinned_comment": story.get("pinned_comment", ""),
        "thumbnail_text": story.get("thumbnail_text", ""),
        "language": "English",
        "visibility": "public",
        "made_for_kids": False,
        "embeds": True,
        "comments_enabled": True,
        "content_type": "documentary",
        "seo_data": {
            "title_tag": story.get("title", ""),
            "meta_description": story.get("seo_description", "")[:160],
            "slug": story.get("title", "").lower().replace(" ", "-").replace(":", "")[:80],
        },
        "upload_config": {
            "privacy": "public",
            "license": "youtube",
            "public_stats_viewable": True,
        },
    }

    meta_dir = os.path.join(project_dir, "metadata")
    os.makedirs(meta_dir, exist_ok=True)
    path = os.path.join(meta_dir, "metadata.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    return meta
