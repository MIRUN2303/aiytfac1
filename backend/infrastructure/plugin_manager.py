import logging
from typing import Dict, Any, Optional, Callable
from database import SessionLocal
from models import Plugin, PluginType
from sqlalchemy import select

logger = logging.getLogger(__name__)


class PluginManager:
    def __init__(self):
        self._providers: Dict[str, Dict[str, Any]] = {}
        self._hooks: Dict[str, list[Callable]] = {}

    async def load_plugins(self):
        try:
            async with SessionLocal() as session:
                result = await session.execute(select(Plugin).where(Plugin.enabled == True).order_by(Plugin.priority))
                plugins = result.scalars().all()
                for p in plugins:
                    self._register_provider(p)
                logger.info(f"Loaded {len(plugins)} plugins")
        except Exception as e:
            logger.error(f"Error loading plugins: {e}")

    def _register_provider(self, plugin: Plugin):
        key = f"{plugin.type.value}:{plugin.name}"
        self._providers[key] = {
            "id": plugin.id,
            "name": plugin.name,
            "type": plugin.type.value,
            "config": plugin.config,
            "priority": plugin.priority,
        }
        logger.info(f"Registered provider: {key}")

    def unregister(self, plugin_id: int):
        to_remove = [k for k, v in self._providers.items() if v["id"] == plugin_id]
        for k in to_remove:
            del self._providers[k]
            logger.info(f"Unregistered provider: {k}")

    def get_provider(self, provider_type: str) -> Optional[Dict[str, Any]]:
        candidates = [(k, v) for k, v in self._providers.items() if v["type"] == provider_type]
        if not candidates:
            return None
        candidates.sort(key=lambda x: x[1]["priority"])
        return candidates[0][1]

    def get_all_providers(self) -> list[Dict[str, Any]]:
        return list(self._providers.values())

    def register_hook(self, hook_name: str, callback: Callable):
        if hook_name not in self._hooks:
            self._hooks[hook_name] = []
        self._hooks[hook_name].append(callback)

    def trigger_hook(self, hook_name: str, **kwargs):
        for cb in self._hooks.get(hook_name, []):
            try:
                cb(**kwargs)
            except Exception as e:
                logger.error(f"Hook {hook_name} error: {e}")


plugin_manager = PluginManager()
