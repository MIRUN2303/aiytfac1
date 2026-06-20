from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import UploadLog, Project
from infrastructure.upload_service import upload_to_youtube, prepare_upload_metadata

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _upload_to_dict(u: UploadLog) -> dict:
    return {
        "id": u.id,
        "project_id": u.project_id,
        "platform": u.platform,
        "video_id": u.video_id,
        "video_url": u.video_url,
        "status": u.status,
        "uploaded_at": u.uploaded_at.isoformat() if u.uploaded_at else None,
        "response": u.response_json,
    }


@router.get("/")
async def list_uploads(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UploadLog).order_by(desc(UploadLog.uploaded_at)).offset(offset).limit(limit)
    )
    uploads = result.scalars().all()
    return [_upload_to_dict(u) for u in uploads]


@router.get("/history")
async def get_upload_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UploadLog).order_by(desc(UploadLog.uploaded_at)).limit(100)
    )
    uploads = result.scalars().all()

    total = len(uploads)
    successful = sum(1 for u in uploads if u.status == "completed")
    failed = sum(1 for u in uploads if u.status == "failed")

    return {
        "total": total,
        "successful": successful,
        "failed": failed,
        "uploads": [_upload_to_dict(u) for u in uploads],
    }


@router.get("/{upload_id}")
async def get_upload(upload_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UploadLog).where(UploadLog.id == upload_id))
    upload = result.scalar_one_or_none()
    if not upload:
        raise HTTPException(404, "Upload not found")
    return _upload_to_dict(upload)


class YouTubeUploadBody(BaseModel):
    project_id: int
    privacy_status: str = "public"
    made_for_kids: bool = False


@router.post("/youtube")
async def upload_to_youtube_endpoint(body: YouTubeUploadBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == body.project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    if not project.video_path or not os.path.exists(project.video_path):
        raise HTTPException(400, "Video file not found. Complete video generation first.")

    import os

    metadata = project.metadata_json or {}
    result_data = await upload_to_youtube(
        project_id=body.project_id,
        video_path=project.video_path,
        title=metadata.get("title", project.topic),
        description=metadata.get("description", ""),
        tags=metadata.get("tags", []),
        category=metadata.get("category", "Education"),
        privacy_status=body.privacy_status,
        made_for_kids=body.made_for_kids,
    )

    if result_data["success"]:
        return {
            "message": "Upload completed",
            "video_id": result_data["video_id"],
            "video_url": result_data["video_url"],
        }
    else:
        raise HTTPException(500, f"Upload failed: {result_data.get('error', 'Unknown error')}")
