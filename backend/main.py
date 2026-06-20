import os
import json
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import projects, settings, queue, system, plugins, scheduler, uploads
from queue_system import job_queue
from infrastructure.logging_service import setup_file_logging
from infrastructure.plugin_manager import plugin_manager
from infrastructure.scheduler_service import scheduler_loop
from database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

connected_websockets: dict[str, list[WebSocket]] = {}
system_websockets: list[WebSocket] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI YouTube Factory API...")
    setup_file_logging()
    await init_db()
    job_queue.start_workers(3)
    await job_queue.recover_interrupted_jobs()
    await plugin_manager.load_plugins()
    scheduler_task = asyncio.create_task(scheduler_loop(60))
    logger.info("Application started")
    yield
    logger.info("Shutting down...")
    scheduler_task.cancel()
    await job_queue.stop_workers()


app = FastAPI(
    title="AI YouTube Factory API",
    description="Automated Content Creation Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(settings.router)
app.include_router(queue.router)
app.include_router(system.router)
app.include_router(plugins.router)
app.include_router(scheduler.router)
app.include_router(uploads.router)

projects_dir = os.path.join(os.path.dirname(__file__), "..", "projects")
os.makedirs(projects_dir, exist_ok=True)
if os.path.exists(projects_dir):
    app.mount("/static", StaticFiles(directory=projects_dir), name="static")


@app.get("/")
def read_root():
    return {"message": "Welcome to AI YouTube Factory API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "workers": len(job_queue.workers),
        "active_workers": sum(1 for t in job_queue.workers if not t.done()),
        "queue_size": job_queue.queue.qsize(),
        "running_jobs": len(job_queue.running_jobs),
    }


@app.get("/api-info")
def api_info():
    routes = []
    for route in app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            for method in route.methods:
                routes.append({"path": route.path, "method": method})
    return {"endpoints": routes}


@app.websocket("/ws/{project_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: int):
    await websocket.accept()
    pid_str = str(project_id)
    if pid_str not in connected_websockets:
        connected_websockets[pid_str] = []
    connected_websockets[pid_str].append(websocket)

    async def send_progress(data: dict):
        for ws in connected_websockets.get(pid_str, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass

    job_queue.subscribe(project_id, send_progress)

    try:
        await websocket.send_json({"type": "connected", "project_id": project_id})
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        try:
            connected_websockets[pid_str].remove(websocket)
        except ValueError:
            pass
        if pid_str in connected_websockets and not connected_websockets[pid_str]:
            del connected_websockets[pid_str]
        job_queue.unsubscribe(project_id, send_progress)


@app.websocket("/ws/system")
async def system_websocket(websocket: WebSocket):
    await websocket.accept()
    system_websockets.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("action") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        try:
            system_websockets.remove(websocket)
        except ValueError:
            pass


@app.post("/admin/stats")
async def admin_stats():
    cpu = 0.0
    memory = {}
    disk = {}
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.1)
        memory = {
            "total": psutil.virtual_memory().total,
            "available": psutil.virtual_memory().available,
            "percent": psutil.virtual_memory().percent,
        }
        disk = {
            "total": psutil.disk_usage("/").total,
            "free": psutil.disk_usage("/").free,
            "percent": psutil.disk_usage("/").percent,
        }
    except ImportError:
        pass

    return {
        "cpu_percent": cpu,
        "memory": memory,
        "disk": disk,
        "workers": {
            "active": sum(1 for t in job_queue.workers if not t.done()),
            "total": len(job_queue.workers),
        },
        "queue": job_queue.queue.qsize(),
        "running_jobs": len(job_queue.running_jobs),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
