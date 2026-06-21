import os
import json
import logging
import urllib.parse
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_
from pydantic import BaseModel

from database import get_db
from models import Project, JobStatus, Log
from queue_system import job_queue

logger = logging.getLogger("projects_router")

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    topic: str
    summary: str = ""
    language: str = "auto"
    target_audience: str = "general"
    duration: str = "medium"
    voice_style: str = "neutral"
    story_style: str = "narrative"


class ProjectUpdate(BaseModel):
    topic: Optional[str] = None
    summary: Optional[str] = None
    language: Optional[str] = None
    target_audience: Optional[str] = None
    duration: Optional[str] = None
    voice_style: Optional[str] = None
    story_style: Optional[str] = None
    status: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    topic: str
    summary: str
    language: str
    target_audience: str
    duration: str
    voice_style: str
    story_style: str
    status: str
    progress: int
    project_dir: Optional[str] = None
    video_path: Optional[str] = None
    short_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    voice_over_path: Optional[str] = None
    subtitle_paths_json: Optional[dict] = None
    metadata_json: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    checkpoint: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, project):
        obj = cls.model_validate(project, from_attributes=True)
        obj.status = project.status.value if project.status else "Waiting"
        return obj


PROJECTS_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "projects"))


def _path_to_url(file_path: Optional[str]) -> Optional[str]:
    if not file_path:
        return None
    try:
        abs_path = os.path.abspath(file_path)
        if not os.path.exists(abs_path):
            return None
        rel = os.path.relpath(abs_path, PROJECTS_ROOT)
        if rel.startswith(".."):
            return None
        rel_unix = rel.replace("\\", "/")
        encoded = urllib.parse.quote(rel_unix, safe="/")
        return f"/static/{encoded}"
    except (ValueError, OSError) as e:
        logger.warning("_path_to_url failed for %s: %s", file_path, e)
        return None


def _project_to_response(p) -> dict:
    video_url = _path_to_url(p.video_path)
    thumbnail_url = _path_to_url(p.thumbnail_path)
    short_url = _path_to_url(p.short_path)
    voice_url = _path_to_url(p.voice_over_path)
    return {
        "id": p.id,
        "topic": p.topic,
        "summary": p.summary or "",
        "language": p.language,
        "target_audience": p.target_audience,
        "duration": p.duration,
        "voice_style": p.voice_style,
        "story_style": p.story_style,
        "status": p.status.value if p.status else "Waiting",
        "progress": p.progress or 0,
        "project_dir": p.project_dir,
        "video_path": p.video_path,
        "video_url": video_url,
        "thumbnail_url": thumbnail_url,
        "short_url": short_url,
        "voice_url": voice_url,
        "short_path": p.short_path,
        "thumbnail_path": p.thumbnail_path,
        "voice_over_path": p.voice_over_path,
        "subtitle_paths_json": p.subtitle_paths_json,
        "metadata_json": p.metadata_json,
        "checkpoint": p.checkpoint,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.post("/")
async def create_project(project: ProjectCreate, db: AsyncSession = Depends(get_db)):
    db_project = Project(**project.model_dump())
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)

    await job_queue.add_job(db_project.id, project.model_dump())

    return _project_to_response(db_project)


@router.get("/")
async def get_projects(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Project)

    if status:
        status_enum = JobStatus.from_string(status)
        query = query.where(Project.status == status_enum)

    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(Project.topic.ilike(search_term), Project.summary.ilike(search_term))
        )

    query = query.order_by(Project.created_at.desc())
    result = await db.execute(query)
    projects = result.scalars().all()
    return [_project_to_response(p) for p in projects]


@router.get("/{project_id}")
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")
    return _project_to_response(project)


@router.patch("/{project_id}")
async def update_project(project_id: int, update: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    update_data = update.model_dump(exclude_none=True)
    status_str = update_data.pop("status", None)
    if status_str:
        project.status = JobStatus.from_string(status_str)

    for key, val in update_data.items():
        setattr(project, key, val)

    project.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project)
    return _project_to_response(project)


@router.delete("/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    job_queue.cancel_job(project_id)

    if project.project_dir and os.path.exists(project.project_dir):
        import shutil
        shutil.rmtree(project.project_dir, ignore_errors=True)

    await db.execute(delete(Project).where(Project.id == project_id))
    await db.commit()
    return {"message": "Project deleted"}


@router.post("/{project_id}/duplicate")
async def duplicate_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(404, "Project not found")

    new_project = Project(
        topic=original.topic,
        summary=original.summary or "",
        language=original.language,
        target_audience=original.target_audience,
        duration=original.duration,
        voice_style=original.voice_style,
        story_style=original.story_style,
        status=JobStatus.WAITING,
        progress=0,
    )
    db.add(new_project)
    await db.commit()
    await db.refresh(new_project)

    if original.project_dir and os.path.exists(original.project_dir):
        new_dir = new_project.project_dir
        if not new_dir:
            safe_name = "".join(c if c.isalnum() or c in " _-" else "_" for c in original.topic)[:50].strip()
            new_dir = os.path.join(PROJECTS_ROOT, f"{new_project.id}_{safe_name}")
        os.makedirs(new_dir, exist_ok=True)

    return _project_to_response(new_project)


@router.post("/{project_id}/cancel")
async def cancel_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).Where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    cancelled = job_queue.cancel_job(project_id)
    if cancelled:
        project.status = JobStatus.CANCELLED
        project.updated_at = datetime.now(timezone.utc)
        await db.commit()
        return {"message": "Job cancelled"}
    else:
        raise HTTPException(400, "Job is not running or already completed")


@router.post("/{project_id}/archive")
async def archive_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).Where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    project.status = JobStatus.ARCHIVED
    project.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Project archived"}


@router.post("/{project_id}/rerender")
async def rerender_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).Where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    project.status = JobStatus.WAITING
    project.progress = 0
    project.video_path = None
    project.short_path = None
    project.updated_at = datetime.now(timezone.utc)
    await db.commit()

    data = {
        "topic": project.topic,
        "summary": project.summary or "",
        "language": project.language,
        "target_audience": project.target_audience,
        "duration": project.duration,
        "voice_style": project.voice_style,
        "story_style": project.story_style,
    }
    await job_queue.add_job(project_id, data)
    return {"message": "Project re-rendering started"}


@router.get("/{project_id}/download")
async def download_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).Where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    project_dir = project.project_dir
    if not project_dir or not os.path.exists(project_dir):
        raise HTTPException(404, "Project files not found")

    import tempfile
    import zipfile
    from fastapi.responses import FileResponse

    zip_path = os.path.join(tempfile.gettempdir(), f"project_{project_id}.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(project_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, project_dir)
                zf.write(file_path, arcname)

    return FileResponse(zip_path, media_type="application/zip",
                         filename=f"project_{project_id}.zip")


@router.get("/{project_id}/logs")
async def get_project_logs(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Log).where(Log.project_id == project_id).order_by(Log.created_at.desc()).limit(200)
    )
    logs = result.scalars().all()
    return [
        {
            "id": l.id,
            "level": l.level.value if l.level else "INFO",
            "source": l.source,
            "message": l.message,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.get("/{project_id}/files")
async def list_project_files(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).Where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    project_dir = project.project_dir
    if not project_dir or not os.path.exists(project_dir):
        return {"files": []}

    ext_type_map = {
        ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image", ".webp": "image",
        ".mp4": "video", ".webm": "video", ".mov": "video",
        ".mp3": "audio", ".wav": "audio", ".m4a": "audio", ".ogg": "audio",
        ".srt": "subtitle", ".vtt": "subtitle",
        ".json": "data", ".txt": "text", ".md": "text",
        ".zip": "archive",
    }

    files_list = []
    try:
        for root, dirs, files in os.walk(project_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, project_dir)
                try:
                    size = os.path.getsize(full_path)
                    mtime = datetime.fromtimestamp(os.path.getmtime(full_path)).isoformat()
                except OSError:
                    continue
                _, ext = os.path.splitext(file)
                file_type = ext_type_map.get(ext.lower(), "other")
                files_list.append({
                    "filename": file,
                    "path": rel_path,
                    "type": file_type,
                    "size": size,
                    "modified": mtime,
                    "url": _path_to_url(full_path),
                })
    except OSError as e:
        logger.error("Error listing files for project %d: %s", project_id, e)
        return {"files": [], "error": str(e)}

    return {"files": files_list, "project_dir": project_dir}
