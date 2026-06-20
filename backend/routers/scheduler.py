from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import Schedule
from infrastructure.scheduler_service import calculate_next_run, execute_schedule

router = APIRouter(prefix="/scheduler", tags=["scheduler"])


class ScheduleCreate(BaseModel):
    name: str
    topic: str
    summary: str = ""
    language: str = "auto"
    target_audience: str = "general"
    duration: str = "medium"
    voice_style: str = "neutral"
    story_style: str = "narrative"
    cron_expression: str = "*/60 * * * *"


class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    topic: Optional[str] = None
    summary: Optional[str] = None
    language: Optional[str] = None
    target_audience: Optional[str] = None
    duration: Optional[str] = None
    voice_style: Optional[str] = None
    story_style: Optional[str] = None
    cron_expression: Optional[str] = None
    enabled: Optional[bool] = None


def _schedule_to_dict(s: Schedule) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "topic": s.topic,
        "summary": s.summary or "",
        "language": s.language,
        "target_audience": s.target_audience,
        "duration": s.duration,
        "voice_style": s.voice_style,
        "story_style": s.story_style,
        "cron_expression": s.cron_expression,
        "enabled": s.enabled,
        "next_run": s.next_run.isoformat() if s.next_run else None,
        "last_run": s.last_run.isoformat() if s.last_run else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/")
async def list_schedules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Schedule).order_by(Schedule.created_at.desc()))
    schedules = result.scalars().all()
    return [_schedule_to_dict(s) for s in schedules]


@router.post("/")
async def create_schedule(schedule: ScheduleCreate, db: AsyncSession = Depends(get_db)):
    db_schedule = Schedule(**schedule.model_dump())
    db_schedule.next_run = calculate_next_run(schedule.cron_expression)
    db.add(db_schedule)
    await db.commit()
    await db.refresh(db_schedule)
    return _schedule_to_dict(db_schedule)


@router.patch("/{schedule_id}")
async def update_schedule(schedule_id: int, update: ScheduleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    update_data = update.model_dump(exclude_none=True)
    cron_changed = "cron_expression" in update_data

    for key, val in update_data.items():
        setattr(schedule, key, val)

    if cron_changed:
        schedule.next_run = calculate_next_run(schedule.cron_expression)

    await db.commit()
    await db.refresh(schedule)
    return _schedule_to_dict(schedule)


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    await db.delete(schedule)
    await db.commit()
    return {"message": "Schedule deleted"}


@router.post("/{schedule_id}/run-now")
async def run_schedule_now(schedule_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(404, "Schedule not found")

    import asyncio
    asyncio.create_task(execute_schedule(schedule))
    return {"message": f"Schedule '{schedule.name}' triggered"}
