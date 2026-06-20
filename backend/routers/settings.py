import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Any, Optional

from database import get_db
from models import Setting

router = APIRouter(prefix="/settings", tags=["settings"])


DEFAULT_SETTINGS = {
    "pollinations_endpoint": "https://image.pollinations.ai/prompt/",
    "retry_interval": 60,
    "max_retries": 3,
    "worker_count": 3,
    "piper_path": "piper",
    "ffmpeg_path": "ffmpeg",
    "max_image_size": 1920,
    "output_resolution": "1920x1080",
    "default_language": "en",
    "max_project_duration": 15,
    "upload_enabled": False,
    "upload_platform": "youtube",
    "temp_dir": None,
}


@router.get("/")
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting))
    settings_rows = result.scalars().all()
    settings_dict = dict(DEFAULT_SETTINGS)
    for row in settings_rows:
        settings_dict[row.key] = row.value
    return settings_dict


@router.post("/")
async def update_settings(settings: dict, db: AsyncSession = Depends(get_db)):
    for key, value in settings.items():
        result = await db.execute(select(Setting).where(Setting.key == key))
        existing = result.scalar_one_or_none()
        if existing:
            existing.value = value
            existing.updated_at = datetime.now(timezone.utc)
        else:
            new_setting = Setting(key=key, value=value)
            db.add(new_setting)
    await db.commit()
    return await get_settings(db)


@router.get("/{key}")
async def get_setting(key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Setting).where(Setting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        if key in DEFAULT_SETTINGS:
            return {"key": key, "value": DEFAULT_SETTINGS[key]}
        raise HTTPException(404, f"Setting '{key}' not found")
    return {"key": setting.key, "value": setting.value}


@router.put("/{key}")
async def update_setting(key: str, body: dict, db: AsyncSession = Depends(get_db)):
    value = body.get("value")
    if value is None:
        raise HTTPException(400, "value field required")

    result = await db.execute(select(Setting).where(Setting.key == key))
    existing = result.scalar_one_or_none()
    if existing:
        existing.value = value
        existing.updated_at = datetime.now(timezone.utc)
    else:
        new_setting = Setting(key=key, value=value)
        db.add(new_setting)

    await db.commit()
    return {"key": key, "value": value}
