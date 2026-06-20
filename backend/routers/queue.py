from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db
from models import Project, JobStatus
from queue_system import job_queue

router = APIRouter(prefix="/queue", tags=["queue"])


@router.get("/")
async def get_queue_status(db: AsyncSession = Depends(get_db)):
    counts = {}
    for status in JobStatus:
        result = await db.execute(
            select(func.count(Project.id)).where(Project.status == status)
        )
        counts[status.name] = result.scalar() or 0

    return {
        "queue_size": job_queue.queue.qsize(),
        "running_jobs": len(job_queue.running_jobs),
        "active_workers": sum(1 for t in job_queue.workers if not t.done()),
        "total_workers": len(job_queue.workers),
        "counts": counts,
    }


@router.get("/active")
async def get_active_jobs(db: AsyncSession = Depends(get_db)):
    running_statuses = [JobStatus.GENERATING_SCRIPT, JobStatus.GENERATING_METADATA,
                        JobStatus.GENERATING_SCENES, JobStatus.GENERATING_IMAGES,
                        JobStatus.GENERATING_VOICE, JobStatus.GENERATING_SUBTITLES,
                        JobStatus.GENERATING_THUMBNAIL, JobStatus.EDITING_VIDEO,
                        JobStatus.RENDERING, JobStatus.GENERATING_SHORTS, JobStatus.UPLOADING]

    result = await db.execute(
        select(Project).where(Project.status.in_(running_statuses)).order_by(Project.created_at.desc())
    )
    projects = result.scalars().all()

    return [
        {
            "id": p.id,
            "topic": p.topic,
            "status": p.status.value if p.status else "Unknown",
            "progress": p.progress or 0,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in projects
    ]


@router.post("/clear")
async def clear_queue(db: AsyncSession = Depends(get_db)):
    terminal_statuses = [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED, JobStatus.ARCHIVED]

    result = await db.execute(
        select(Project).where(Project.status.in_(terminal_statuses))
    )
    projects = result.scalars().all()

    count = len(projects)
    for p in projects:
        db.delete(p)
    await db.commit()

    return {"message": f"Cleared {count} completed/failed/cancelled/archived jobs"}


@router.post("/retry/{project_id}")
async def retry_job(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    if project.status not in [JobStatus.FAILED, JobStatus.CANCELLED]:
        raise HTTPException(400, "Only failed or cancelled jobs can be retried")

    project.status = JobStatus.WAITING
    project.progress = 0
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

    return {"message": "Job queued for retry", "project_id": project_id}
