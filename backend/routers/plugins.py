from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, Any

from database import get_db
from models import Plugin, PluginType
from infrastructure.plugin_manager import plugin_manager

router = APIRouter(prefix="/plugins", tags=["plugins"])


class PluginCreate(BaseModel):
    name: str
    type: str
    enabled: bool = True
    config: dict = {}
    priority: int = 0


class PluginUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    config: Optional[dict] = None
    priority: Optional[int] = None


def _plugin_to_dict(p: Plugin) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "type": p.type.value if p.type else None,
        "enabled": p.enabled,
        "config": p.config or {},
        "priority": p.priority or 0,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/")
async def list_plugins(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Plugin).order_by(Plugin.priority))
    plugins = result.scalars().all()
    return [_plugin_to_dict(p) for p in plugins]


@router.post("/")
async def create_plugin(plugin: PluginCreate, db: AsyncSession = Depends(get_db)):
    try:
        plugin_type = PluginType(plugin.type)
    except ValueError:
        raise HTTPException(400, f"Invalid plugin type: {plugin.type}. Valid: llm, image, voice, video, upload")

    db_plugin = Plugin(
        name=plugin.name,
        type=plugin_type,
        enabled=plugin.enabled,
        config=plugin.config,
        priority=plugin.priority,
    )
    db.add(db_plugin)
    await db.commit()
    await db.refresh(db_plugin)

    await plugin_manager.load_plugins()
    return _plugin_to_dict(db_plugin)


@router.patch("/{plugin_id}")
async def update_plugin(plugin_id: int, update: PluginUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Plugin).where(Plugin.id == plugin_id))
    plugin = result.scalar_one_or_none()
    if not plugin:
        raise HTTPException(404, "Plugin not found")

    update_data = update.model_dump(exclude_none=True)
    for key, val in update_data.items():
        if key == "type":
            try:
                val = PluginType(val)
            except ValueError:
                raise HTTPException(400, f"Invalid plugin type: {val}")
        setattr(plugin, key, val)

    await db.commit()
    await db.refresh(plugin)

    await plugin_manager.load_plugins()
    return _plugin_to_dict(plugin)


@router.delete("/{plugin_id}")
async def delete_plugin(plugin_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Plugin).where(Plugin.id == plugin_id))
    plugin = result.scalar_one_or_none()
    if not plugin:
        raise HTTPException(404, "Plugin not found")

    await db.delete(plugin)
    await db.commit()
    plugin_manager.unregister(plugin_id)
    return {"message": "Plugin deleted"}


@router.post("/{plugin_id}/test")
async def test_plugin(plugin_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Plugin).where(Plugin.id == plugin_id))
    plugin = result.scalar_one_or_none()
    if not plugin:
        raise HTTPException(404, "Plugin not found")

    import httpx
    config = plugin.config or {}
    test_url = config.get("endpoint") or config.get("url")

    if test_url:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(test_url)
                if resp.status_code < 500:
                    return {"status": "ok", "message": f"Plugin reachable at {test_url}", "code": resp.status_code}
                else:
                    return {"status": "error", "message": f"Plugin returned {resp.status_code}"}
        except Exception as e:
            return {"status": "error", "message": f"Cannot reach plugin: {e}"}
    else:
        return {"status": "unknown", "message": "No endpoint configured for testing"}
