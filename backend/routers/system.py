import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from database import get_db, init_db
from queue_system import job_queue
from infrastructure.logging_service import export_logs

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

router = APIRouter(prefix="/system", tags=["system"])


def _get_cpu_usage():
    if PSUTIL_AVAILABLE:
        return psutil.cpu_percent(interval=0.1)
    import subprocess
    try:
        result = subprocess.run(
            ["wmic", "cpu", "get", "loadpercentage"],
            capture_output=True, text=True, timeout=5
        )
        lines = result.stdout.strip().split("\n")
        if len(lines) >= 2:
            return float(lines[1].strip())
    except Exception:
        pass
    return 0.0


def _get_memory_usage():
    if PSUTIL_AVAILABLE:
        mem = psutil.virtual_memory()
        return {
            "total": mem.total,
            "available": mem.available,
            "percent": mem.percent,
            "used": mem.used,
        }
    return {"total": 0, "available": 0, "percent": 0, "used": 0}


def _get_disk_usage():
    if PSUTIL_AVAILABLE:
        disk = psutil.disk_usage(os.path.abspath(os.sep))
        return {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": disk.percent,
        }
    return {"total": 0, "used": 0, "free": 0, "percent": 0}


@router.get("/status")
async def get_system_status(db: AsyncSession = Depends(get_db)):
    from models import Project, JobStatus
    from sqlalchemy import select, func

    counts = {}
    for status in JobStatus:
        result = await db.execute(
            select(func.count(Project.id)).where(Project.status == status)
        )
        counts[status.name] = result.scalar() or 0

    return {
        "app": "AI YouTube Factory",
        "version": "1.0.0",
        "queue": {
            "size": job_queue.queue.qsize(),
            "running": len(job_queue.running_jobs),
            "workers_active": sum(1 for t in job_queue.workers if not t.done()),
            "workers_total": len(job_queue.workers),
        },
        "projects": counts,
        "health": "ok",
    }


@router.get("/stats")
async def get_system_stats():
    return {
        "cpu": _get_cpu_usage(),
        "memory": _get_memory_usage(),
        "disk": _get_disk_usage(),
        "python_version": __import__("sys").version,
    }


@router.get("/worker")
async def get_worker_status():
    return {
        "active_workers": sum(1 for t in job_queue.workers if not t.done()),
        "total_workers": len(job_queue.workers),
        "running_jobs": list(job_queue.running_jobs.keys()),
        "queue_size": job_queue.queue.qsize(),
    }


@router.post("/worker/restart")
async def restart_workers():
    await job_queue.restart_workers()
    return {"message": "Workers restarted"}


class WorkerCountBody(BaseModel):
    count: int


@router.post("/worker/set-count")
async def set_worker_count(body: WorkerCountBody):
    if body.count < 1:
        raise HTTPException(400, "Worker count must be at least 1")
    job_queue.set_worker_count(body.count)
    await job_queue.restart_workers(body.count)
    return {"message": f"Worker count set to {body.count}"}


@router.get("/logs")
async def get_system_logs(
    level: Optional[str] = None,
    source: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    logs = await export_logs(level=level, source=source, limit=limit, offset=offset)
    return {"logs": logs, "count": len(logs)}


@router.get("/debug-paths")
async def debug_paths():
    results = {}
    results["cwd"] = os.getcwd()
    
    candidates = ["/projects/1_Photosynthesis", "/projects/1_Solar System", "/projects"]
    for d in candidates:
        results[d] = os.path.exists(d)
        if os.path.exists(d):
            results[d + "_abspath"] = os.path.abspath(d)
            try:
                walk_items = []
                for r, dirs, files in os.walk(d):
                    for f in sorted(files)[:5]:
                        fp = os.path.join(r, f)
                        try:
                            sz = os.path.getsize(fp)
                        except Exception as size_e:
                            sz = f"err:{size_e}"
                        walk_items.append({"dir": r, "file": f, "size": sz})
                    if walk_items:
                        break
                results[d + "_walk"] = walk_items if walk_items else "no_files_found_in_first_dir"
                results[d + "_walk_dir_count"] = len([x for x in os.scandir(d) if x.is_dir()]) if os.path.isdir(d) else -1
                results[d + "_walk_file_count"] = len([x for x in os.scandir(d) if x.is_file()]) if os.path.isdir(d) else -1
            except Exception as e:
                results[d + "_walk_error"] = f"{type(e).__name__}: {e}"
    
    return results


@router.get("/health")
async def detailed_health_check():
    checks = {
        "database": False,
        "queue": False,
        "workers": False,
    }

    try:
        from database import engine
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        checks["database"] = True
    except Exception:
        pass

    checks["queue"] = job_queue.queue.qsize() >= 0
    checks["workers"] = any(not t.done() for t in job_queue.workers) if job_queue.workers else False

    all_ok = all(checks.values())
    return {
        "status": "healthy" if all_ok else "degraded",
        "checks": checks,
        "timestamp": __import__("datetime").datetime.now(timezone.utc).isoformat(),
    }
