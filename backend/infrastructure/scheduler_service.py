import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
import re

from database import SessionLocal
from models import Schedule
from queue_system import job_queue
from sqlalchemy import select

logger = logging.getLogger(__name__)


def parse_cron_minutes(cron_expression: str) -> Optional[int]:
    cron_expression = cron_expression.strip()
    if cron_expression.startswith("*/"):
        try:
            interval = int(cron_expression[2:].split()[0])
            return interval
        except ValueError:
            return None
    parts = cron_expression.split()
    if len(parts) >= 2:
        minute_part = parts[0]
        hour_part = parts[1]
        if minute_part == "*" and hour_part == "*":
            return 1
        if minute_part == "*":
            return 60
        if minute_part.isdigit():
            return int(minute_part)
    return None


def calculate_next_run(cron_expression: str) -> Optional[datetime]:
    interval_minutes = parse_cron_minutes(cron_expression)
    if interval_minutes:
        return datetime.now(timezone.utc) + timedelta(minutes=interval_minutes)
    return datetime.now(timezone.utc) + timedelta(hours=1)


async def execute_schedule(schedule: Schedule):
    data = {
        "topic": schedule.topic,
        "summary": schedule.summary or "",
        "language": schedule.language,
        "target_audience": schedule.target_audience,
        "duration": schedule.duration,
        "voice_style": schedule.voice_style,
        "story_style": schedule.story_style,
    }
    try:
        async with SessionLocal() as session:
            from models import Project
            project = Project(topic=schedule.topic, summary=schedule.summary or "",
                              language=schedule.language, target_audience=schedule.target_audience,
                              duration=schedule.duration, voice_style=schedule.voice_style,
                              story_style=schedule.story_style)
            session.add(project)
            await session.commit()
            await session.refresh(project)
            project_id = project.id

        await job_queue.add_job(project_id, data)
        logger.info(f"Schedule '{schedule.name}' created project {project_id}")

        async with SessionLocal() as session:
            result = await session.execute(select(Schedule).where(Schedule.id == schedule.id))
            s = result.scalar_one_or_none()
            if s:
                s.last_run = datetime.now(timezone.utc)
                s.next_run = calculate_next_run(s.cron_expression)
                await session.commit()
    except Exception as e:
        logger.error(f"Error executing schedule '{schedule.name}': {e}")


async def scheduler_loop(interval_seconds: int = 60):
    logger.info("Scheduler service started")
    while True:
        try:
            async with SessionLocal() as session:
                now = datetime.now(timezone.utc)
                result = await session.execute(
                    select(Schedule).where(
                        Schedule.enabled == True,
                        (Schedule.next_run == None) | (Schedule.next_run <= now)
                    )
                )
                schedules = result.scalars().all()
                for schedule in schedules:
                    logger.info(f"Triggering schedule '{schedule.name}'")
                    asyncio.create_task(execute_schedule(schedule))
                    if schedule.next_run is None:
                        schedule.next_run = calculate_next_run(schedule.cron_expression)
                        await session.commit()
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        await asyncio.sleep(interval_seconds)
