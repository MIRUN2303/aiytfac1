import logging
import json
from datetime import datetime, timezone
from typing import Optional

from database import SessionLocal
from models import UploadLog, Project

logger = logging.getLogger(__name__)


async def upload_to_youtube(
    project_id: int,
    video_path: str,
    title: str,
    description: str,
    tags: list[str],
    category: str = "Education",
    privacy_status: str = "public",
    made_for_kids: bool = False,
) -> dict:
    result = {
        "success": False,
        "video_id": None,
        "video_url": None,
        "error": None,
    }

    try:
        logger.info(f"Preparing YouTube upload for project {project_id}: {title}")

        video_id = f"sim_{project_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        video_url = f"https://youtube.com/watch?v={video_id}"

        upload_log = UploadLog(
            project_id=project_id,
            platform="youtube",
            video_id=video_id,
            video_url=video_url,
            status="completed",
            response_json={
                "title": title,
                "description": description[:200],
                "tags": tags[:10],
                "category": category,
                "privacy_status": privacy_status,
                "made_for_kids": made_for_kids,
                "simulated": True,
            },
        )

        async with SessionLocal() as session:
            session.add(upload_log)
            try:
                from sqlalchemy import select
                db_result = await session.execute(select(Project).where(Project.id == project_id))
                project = db_result.scalar_one_or_none()
                if project:
                    if project.metadata_json is None:
                        project.metadata_json = {}
                    project.metadata_json["uploaded"] = True
                    project.metadata_json["video_id"] = video_id
                    project.metadata_json["video_url"] = video_url
            except Exception as db_e:
                logger.warning(f"Could not update project metadata: {db_e}")
            await session.commit()

        result["success"] = True
        result["video_id"] = video_id
        result["video_url"] = video_url
        logger.info(f"YouTube upload simulated for project {project_id}: {video_url}")

    except Exception as e:
        result["error"] = str(e)
        logger.error(f"YouTube upload failed for project {project_id}: {e}")
        try:
            async with SessionLocal() as session:
                upload_log = UploadLog(
                    project_id=project_id,
                    platform="youtube",
                    status="failed",
                    response_json={"error": str(e)},
                )
                session.add(upload_log)
                await session.commit()
        except Exception:
            pass

    return result


def prepare_upload_metadata(project_data: dict) -> dict:
    return {
        "title": project_data.get("title", "Untitled Video"),
        "description": project_data.get("description", ""),
        "tags": project_data.get("tags", []),
        "category": project_data.get("category", "Education"),
        "privacy_status": project_data.get("visibility", "public"),
        "made_for_kids": project_data.get("made_for_kids", False),
        "pinned_comment": project_data.get("pinned_comment", ""),
    }
