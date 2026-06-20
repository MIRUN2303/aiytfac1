import logging
import json
import os
from datetime import datetime
from typing import Optional
from database import SessionLocal
from models import Log, LogLevel

logger = logging.getLogger(__name__)
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

_file_handler = None


def setup_file_logging():
    global _file_handler
    log_path = os.path.join(LOG_DIR, "app.log")
    _file_handler = logging.FileHandler(log_path, encoding="utf-8", mode="a")
    _file_handler.setFormatter(logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    ))
    root_logger = logging.getLogger()
    root_logger.addHandler(_file_handler)
    root_logger.setLevel(logging.INFO)
    logger.info(f"File logging initialized at {log_path}")


async def log_event(
    level: LogLevel,
    source: str,
    message: str,
    project_id: Optional[int] = None,
    details: Optional[dict] = None,
):
    try:
        async with SessionLocal() as session:
            log_entry = Log(
                project_id=project_id,
                level=level,
                source=source,
                message=message,
                details=details or {},
            )
            session.add(log_entry)
            await session.commit()
    except Exception as e:
        logger.error(f"Failed to log event to DB: {e}")

    level_name = level.value if isinstance(level, LogLevel) else str(level)
    log_method = getattr(logger, level_name.lower(), logger.info)
    tag = f"[{source}]" if source else ""
    log_method(f"{tag} {message}")


async def export_logs(
    level: Optional[str] = None,
    source: Optional[str] = None,
    project_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    try:
        async with SessionLocal() as session:
            from sqlalchemy import select, desc
            query = select(Log)

            if level:
                try:
                    level_enum = LogLevel(level.upper())
                    query = query.where(Log.level == level_enum)
                except ValueError:
                    pass
            if source:
                query = query.where(Log.source == source)
            if project_id is not None:
                query = query.where(Log.project_id == project_id)

            query = query.order_by(desc(Log.created_at)).offset(offset).limit(limit)
            result = await session.execute(query)
            logs = result.scalars().all()

            return [
                {
                    "id": log.id,
                    "project_id": log.project_id,
                    "level": log.level.value if log.level else "INFO",
                    "source": log.source,
                    "message": log.message,
                    "details": log.details,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in logs
            ]
    except Exception as e:
        logger.error(f"Failed to export logs: {e}")
        return []


def get_log_file_path() -> str:
    return os.path.join(LOG_DIR, "app.log")
