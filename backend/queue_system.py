import asyncio
import logging
from typing import Dict, Any, Callable, Optional
from datetime import datetime, timezone

from application.project_service import run_pipeline
from database import SessionLocal
from models import Project, JobStatus, Log, LogLevel

logger = logging.getLogger(__name__)


class JobQueue:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.workers: list[asyncio.Task] = []
        self.progress_listeners: Dict[int, list[Callable]] = {}
        self.running_jobs: Dict[int, asyncio.Task] = {}
        self._running = False
        self._num_workers = 2
        self._scheduler_task: Optional[asyncio.Task] = None

    def _get_db_updater(self, project_id: int):
        async def update_db(status: str, progress: int, message: Optional[str] = None):
            try:
                async with SessionLocal() as session:
                    from sqlalchemy import select
                    result = await session.execute(select(Project).where(Project.id == project_id))
                    project = result.scalar_one_or_none()
                    if project:
                        if status == "INTERRUPTED":
                            project.status = JobStatus.FAILED
                            project.progress = progress
                        else:
                            for js in JobStatus:
                                if js.name == status or js.value == status:
                                    project.status = js
                                    break
                            project.progress = progress
                        project.updated_at = datetime.now(timezone.utc)
                        await session.commit()

                    if message:
                        log_entry = Log(
                            project_id=project_id,
                            level=LogLevel.ERROR if status == "FAILED" else LogLevel.INFO,
                            source="pipeline",
                            message=message,
                            details={"status": status, "progress": progress},
                        )
                        session.add(log_entry)
                        await session.commit()
            except Exception as e:
                logger.error(f"DB update error for project {project_id}: {e}")

            for listener in self.progress_listeners.get(project_id, []):
                try:
                    await listener({"project_id": project_id, "status": status, "progress": progress, "message": message})
                except Exception:
                    pass
        return update_db

    async def worker_loop(self, worker_id: int):
        logger.info(f"Worker {worker_id} started")
        while self._running:
            try:
                job_data = await asyncio.wait_for(self.queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            project_id = job_data.get("project_id")
            if not project_id:
                self.queue.task_done()
                continue

            logger.info(f"Worker {worker_id} processing project {project_id}")

            async def progress_callback(status: str, progress: int, message: Optional[str] = None):
                updater = self._get_db_updater(project_id)
                await updater(status, progress, message)

            task = asyncio.create_task(
                self._run_job(project_id, job_data.get("data", {}), progress_callback)
            )
            self.running_jobs[project_id] = task

            try:
                await task
            except asyncio.CancelledError:
                logger.info(f"Project {project_id} cancelled")
                updater = self._get_db_updater(project_id)
                await updater("CANCELLED", 0, "Job was cancelled by user")
            except Exception as e:
                logger.error(f"Project {project_id} failed: {e}")
                updater = self._get_db_updater(project_id)
                await updater("FAILED", 0, f"Pipeline failed: {e}")
            finally:
                self.running_jobs.pop(project_id, None)
                self.queue.task_done()

    async def _run_job(self, project_id: int, data: dict, progress_callback):
        await run_pipeline(project_id, data, progress_callback)

    def start_workers(self, num_workers: int = 2):
        if self._running:
            return
        self._running = True
        self._num_workers = num_workers
        for i in range(num_workers):
            task = asyncio.create_task(self.worker_loop(i))
            self.workers.append(task)
        logger.info(f"Started {num_workers} workers")

    async def stop_workers(self):
        self._running = False
        for task in self.workers:
            task.cancel()
        if self.workers:
            await asyncio.gather(*self.workers, return_exceptions=True)
        self.workers.clear()
        logger.info("All workers stopped")

    async def restart_workers(self, num_workers: Optional[int] = None):
        await self.stop_workers()
        await asyncio.sleep(0.5)
        self._running = False
        self.workers.clear()
        self.start_workers(num_workers or self._num_workers)

    def set_worker_count(self, count: int):
        if count < 1:
            count = 1
        self._num_workers = count

    async def add_job(self, project_id: int, data: Any):
        await self.queue.put({"project_id": project_id, "data": data})
        logger.info(f"Job added for project {project_id}")

    def cancel_job(self, project_id: int):
        task = self.running_jobs.get(project_id)
        if task and not task.done():
            task.cancel()
            logger.info(f"Job cancelled for project {project_id}")
            return True
        return False

    def is_running(self, project_id: int) -> bool:
        return project_id in self.running_jobs and not self.running_jobs[project_id].done()

    def pause_job(self, project_id: int):
        pass

    def resume_job(self, project_id: int):
        pass

    def subscribe(self, project_id: int, callback: Callable):
        if project_id not in self.progress_listeners:
            self.progress_listeners[project_id] = []
        self.progress_listeners[project_id].append(callback)

    def unsubscribe(self, project_id: int, callback: Callable):
        listeners = self.progress_listeners.get(project_id, [])
        if callback in listeners:
            listeners.remove(callback)

    def get_queue_status(self) -> dict:
        return {
            "queue_size": self.queue.qsize(),
            "running_jobs": len(self.running_jobs),
            "active_workers": sum(1 for t in self.workers if not t.done()),
            "total_workers": len(self.workers),
        }

    async def recover_interrupted_jobs(self):
        try:
            async with SessionLocal() as session:
                from sqlalchemy import select
                running_statuses = [JobStatus.GENERATING_SCRIPT, JobStatus.GENERATING_METADATA,
                                    JobStatus.GENERATING_SCENES, JobStatus.GENERATING_IMAGES,
                                    JobStatus.GENERATING_VOICE, JobStatus.GENERATING_SUBTITLES,
                                    JobStatus.GENERATING_THUMBNAIL, JobStatus.EDITING_VIDEO,
                                    JobStatus.RENDERING, JobStatus.GENERATING_SHORTS, JobStatus.UPLOADING]
                result = await session.execute(
                    select(Project).where(Project.status.in_(running_statuses))
                )
                interrupted = result.scalars().all()
                for project in interrupted:
                    project.status = JobStatus.FAILED
                    project.progress = 0
                    logger.warning(f"Recovery: marked project {project.id} as FAILED (interrupted)")
                await session.commit()
                if interrupted:
                    logger.info(f"Recovered {len(interrupted)} interrupted jobs")
        except Exception as e:
            logger.error(f"Error recovering interrupted jobs: {e}")


job_queue = JobQueue()
