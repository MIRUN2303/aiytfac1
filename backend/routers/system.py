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
    results["PROJECTS_ROOT"] = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "projects")
    
    test_dir = "/projects/1_Photosynthesis"
    results["test_dir_exists"] = os.path.exists(test_dir)
    results["test_dir_abspath"] = os.path.abspath(test_dir)
    
    if os.path.exists(test_dir):
        try:
            items = []
            for root, dirs, files in os.walk(test_dir):
                for f in files[:5]:
                    fp = os.path.join(root, f)
                    try:
                        sz = os.path.getsize(fp)
                    except:
                        sz = -1
                    items.append({"file": f, "full_path": fp, "size": sz, "exists": os.path.exists(fp)})
            results["files"] = items
        except Exception as e:
            results["walk_error"] = str(e)
            
    import urllib.parse
    results["url_encode_test"] = urllib.parse.quote("Photosynthesis/video/final.mp4", safe="/")
    
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
