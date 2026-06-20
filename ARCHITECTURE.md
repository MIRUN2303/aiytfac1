# AI YouTube Factory — Architecture & How It Works

## Table of Contents
1. Overview
2. Project Structure
3. Backend Architecture
   - 3.1 Entry Point (main.py)
   - 3.2 Database Models (models.py)
   - 3.3 Job Queue System (queue_system.py)
   - 3.4 Project Pipeline (project_service.py)
   - 3.5 Routers
   - 3.6 Domain Modules
   - 3.7 Infrastructure Modules
   - 3.8 All 17 Job States
4. Frontend Architecture
   - 4.1 Pages & Routes
   - 4.2 Sidebar Navigation
   - 4.3 Dashboard
   - 4.4 API Client
   - 4.5 Styling System
   - 4.6 State Management
5. End-to-End Flow
6. Error Handling
7. How to Debug Errors

---

## 1. Overview

AI YouTube Factory is a full-stack SaaS platform that automatically generates storytelling videos from just a Topic and Summary. It has two major parts:

- **Backend**: Python FastAPI with SQLAlchemy (SQLite), asyncio job queue, 12-stage video generation pipeline
- **Frontend**: Next.js 14 App Router, React 18, TypeScript, TailwindCSS, Framer Motion, shadcn-ui inspired design

The user provides: Topic, Summary, Language, Target Audience, Duration, Voice Style, Story Style.
The system outputs: script, images, voiceover, subtitles, thumbnail, full video, YouTube Short, metadata.

---

## 2. Project Structure

```
AI YouTube Factory/
├── backend/                     # Python FastAPI backend
│   ├── main.py                  # App entry, CORS, routers, WebSockets, health
│   ├── database.py              # Async SQLite engine, session management
│   ├── models.py                # SQLAlchemy models + enums (6 tables)
│   ├── queue_system.py          # Async job queue with 3 workers
│   ├── requirements.txt         # Python dependencies
│   ├── Dockerfile               # Container build
│   ├── application/
│   │   └── project_service.py   # 12-stage pipeline orchestrator
│   ├── domain/
│   │   ├── story_generator.py       # Template-based story (6 styles)
│   │   ├── scene_generator.py       # Scene splitting + camera/transitions
│   │   ├── image_generator.py       # Pollinations → Puter → Pillow fallback
│   │   ├── voice_generator.py       # Piper TTS → synthetic WAV
│   │   ├── subtitle_generator.py    # SRT/VTT/TXT generation
│   │   ├── video_generator.py       # MoviePy → FFmpeg (3 tiers)
│   │   ├── thumbnail_generator.py   # Pillow 1280×720 thumbnail
│   │   └── metadata_generator.py    # YouTube SEO metadata JSON
│   ├── infrastructure/
│   │   ├── pollinations_client.py   # HTTP client for Pollinations AI
│   │   ├── puter_client.py          # HTTP client for Puter AI (fallback)
│   │   ├── plugin_manager.py        # Dynamic plugin/provider registry
│   │   ├── scheduler_service.py     # Cron-based scheduled generation
│   │   ├── upload_service.py        # YouTube upload (simulated)
│   │   └── logging_service.py       # File + DB dual logging
│   ├── routers/
│   │   ├── projects.py      # CRUD + duplicate/cancel/archive/rerender
│   │   ├── settings.py      # Key-value settings CRUD
│   │   ├── queue.py         # Queue status, retry, clear
│   │   ├── system.py        # System stats, workers, health, logs
│   │   ├── plugins.py       # Plugin CRUD + test
│   │   ├── scheduler.py     # Schedule CRUD + run-now
│   │   └── uploads.py       # Upload history + YouTube upload
│   └── tests/
│       ├── test_main.py
│       └── test_api.py
│
├── frontend/                    # Next.js 14 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root layout (sidebar + main + toaster)
│   │   │   ├── page.tsx        # Dashboard (home page)
│   │   │   ├── globals.css     # All custom Tailwind utilities
│   │   │   ├── projects/page.tsx
│   │   │   ├── queue/page.tsx
│   │   │   ├── settings/page.tsx    # 7 tabs
│   │   │   ├── system/page.tsx
│   │   │   ├── logs/page.tsx
│   │   │   ├── plugins/page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   ├── uploads/page.tsx
│   │   │   ├── media/page.tsx
│   │   │   ├── api-keys/page.tsx
│   │   │   ├── templates/page.tsx   # localStorage-backed
│   │   │   └── guide/page.tsx       # Getting started guide
│   │   ├── components/
│   │   │   ├── Sidebar.tsx     # Collapsible nav (11 items, 3 groups)
│   │   │   ├── Dashboard.tsx   # Home page (hero, stats, form, activity, chart)
│   │   │   └── Toaster.tsx     # Lightweight toast notifications
│   │   └── lib/
│   │       └── api.ts          # All API endpoint functions
│   ├── .eslintrc.json
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── next.config.mjs
│   └── Dockerfile
│
├── docker-compose.yml           # Orchestrates backend + frontend
├── .env / .env.example          # Configuration
├── README.md
├── INSTALL.md
└── ARCHITECTURE.md              # ← This file
```

---

## 3. Backend Architecture

### 3.1 Entry Point (main.py)

The backend starts with `python main.py` which:

1. Creates the FastAPI app with title "AI YouTube Factory API" and version "1.0.0"
2. **Lifespan handler** (`async def lifespan(app)`):
   - **Startup**: `init_db()` (creates tables), starts JobQueue workers, initializes PluginManager, starts SchedulerService
   - **Shutdown**: Stops workers, cancels scheduler, closes DB connections
3. Registers **CORS middleware** (allows all origins for development)
4. Mounts **7 routers** at `/projects`, `/settings`, `/queue`, `/system`, `/plugins`, `/scheduler`, `/uploads`
5. Exposes **WebSocket endpoints**:
   - `/ws/{project_id}` — real-time progress per project
   - `/ws/system` — system-wide status updates
6. Exposes `/health` (DB + queue + workers check) and `/admin/stats` (basic stats)

### 3.2 Database Models (models.py)

**6 tables** using SQLAlchemy async ORM with SQLite (aiosqlite):

**Project** — Core entity:
- `id` (Integer PK), `topic` (String, indexed), `summary` (Text), `language`, `target_audience`, `duration`
- `voice_style`, `story_style`, `status` (JobStatus enum), `progress` (Integer, 0-100)
- `project_dir`, `video_path`, `short_path`, `thumbnail_path`, `voice_over_path`
- `subtitle_paths_json` (JSON), `metadata_json` (JSON), `logs` (JSON array)
- `checkpoint` (String — stores last completed stage name)
- `created_at`, `updated_at`, `scheduled_at`

**Setting** — Key-value configuration:
- `id`, `key` (unique, indexed), `value` (JSON), timestamps

**Plugin** — Provider plugins:
- `id`, `name`, `type` (PluginType enum: llm/image/voice/video/upload)
- `enabled` (Boolean), `config` (JSON), `priority` (Integer), timestamps

**UploadLog** — Upload history:
- `id`, `project_id` (FK→projects, ON DELETE SET NULL)
- `platform`, `video_id`, `video_url`, `status`, `response_json` (JSON)
- `uploaded_at`

**Schedule** — Cron-based schedules:
- `id`, `name`, `topic`, `summary`, `language`, `target_audience`, `duration`
- `voice_style`, `story_style`, `cron_expression`, `enabled`
- `next_run`, `last_run`, `created_at`

**Log** — System and project logs:
- `id`, `project_id` (FK→projects, ON DELETE SET NULL, indexed)
- `level` (LogLevel enum: INFO/WARN/ERROR/DEBUG), `source`, `message` (Text)
- `details` (JSON), `created_at`

### 3.3 Job Queue System (queue_system.py)

A singleton `JobQueue` class using Python's `asyncio.Queue`:

**Workers**: N coroutines (default 3) that loop indefinitely pulling jobs from the queue. Each worker calls `run_pipeline()` from `project_service`, handling `CancelledError` (→ CANCELLED status) and generic exceptions (→ FAILED status).

**Progress Pub/Sub**: `progress_listeners` dict maps `project_id → [callbacks]`. When a stage updates, a DB-updater closure both persists the new status/progress to the database and notifies all subscribed callbacks. WebSocket endpoints subscribe to this to push real-time updates to the browser.

**Crash Recovery (`recover_interrupted_jobs`)**:
On startup, queries all projects in any of the 11 intermediate/running states (GENERATING_SCRIPT through UPLOADING) and marks them FAILED with progress 0. This prevents stale "running" jobs after a server restart.

**Key methods**: `add_job()`, `cancel_job()`, `subscribe/unsubscribe`, `restart_workers(count)`, `clear_completed()`

### 3.4 Project Pipeline (project_service.py)

**`run_pipeline(project_id, project_data, progress_callback)`** runs 12 sequential stages, each with checkpoint persistence:

| # | Stage | Status Set | What Happens | Saved Artifacts |
|---|---|---|---|---|
| 1 | Generate Story | GENERATING_SCRIPT | Template-based story with 6 styles, 10 hook templates, SEO data | `script/story.json` |
| 2 | Generate Metadata | GENERATING_METADATA | Title, description, tags, keywords, hashtags, category, SEO | `metadata/metadata.json` |
| 3 | Generate Scenes | GENERATING_SCENES | Split story into timed scenes with narration, camera, transition, music | `script/scenes.json` |
| 4 | Generate Images | GENERATING_IMAGES | Per-scene images: Pollinations → Puter → Pillow placeholder | `images/001.png`… |
| 5 | Generate Voice | GENERATING_VOICE | Piper TTS → synthetic numpy WAV waveform | `voice/voice.wav` |
| 6 | Generate Subtitles | GENERATING_SUBTITLES | SRT + VTT + TXT subtitle files | `subtitles/*` |
| 7 | Generate Thumbnail | GENERATING_THUMBNAIL | Pillow 1280×720 with gradient + text + CTA button | `thumbnail/thumbnail.png` |
| 8 | Render Video | EDITING_VIDEO → RENDERING | MoviePy (Ken Burns, crossfade, audio, subtitles) → FFmpeg fallbacks | `video/final.mp4` |
| 9 | Generate Shorts | GENERATING_SHORTS | Find dramatic scenes, crop to 9:16 vertical | `shorts/short.mp4` |
| 10 | Upload | UPLOADING | Simulated YouTube upload (logs fake video_id) | UploadLog DB row |
| 11 | Complete | COMPLETED | Finalize paths, 100% progress, save all metadata | DB row |

**Checkpoint system**: After each successful stage, `_save_checkpoint()` writes the stage name to `project.checkpoint`. This enables future resume-from-checkpoint functionality (currently only used for marking FAILED on crash recovery).

**Project directory**: `projects/{id}_{topic}/` with subfolders: `script/`, `voice/`, `images/`, `subtitles/`, `thumbnail/`, `video/`, `shorts/`, `metadata/`, `logs/`

### 3.5 Routers

**Projects** (`/projects`):
- `POST /` — Create project from form data, enqueue job, return project
- `GET /` — List all projects (filterable by `status`, `search`)
- `GET /{id}` — Get single project detail
- `PATCH /{id}` — Update project fields
- `DELETE /{id}` — Cancel running job, delete project directory, remove DB row
- `POST /{id}/duplicate` — Clone as WAITING project
- `POST /{id}/cancel` — Cancel running job, set CANCELLED
- `POST /{id}/archive` — Set ARCHIVED status
- `POST /{id}/rerender` — Reset to WAITING, re-enqueue
- `GET /{id}/download` — ZIP all project files
- `GET /{id}/logs` — Project-specific log entries
- `GET /{id}/files` — List project directory tree with file sizes

**Settings** (`/settings`):
- `GET /` — All settings (DB + defaults merged)
- `POST /` — Batch upsert settings
- `GET /{key}` — Single setting (with fallback to default)
- `PUT /{key}` — Upsert single setting

**Queue** (`/queue`):
- `GET /` — Queue status with per-status counts
- `GET /active` — All currently running projects
- `POST /clear` — Delete terminal-state projects
- `POST /retry/{id}` — Reset FAILED/CANCELLED to WAITING, re-enqueue

**System** (`/system`):
- `GET /status` — App version, queue stats, per-status counts
- `GET /stats` — CPU%, memory (used/total), disk (used/free/percent), Python version
- `GET /worker` — Active worker count, running job IDs
- `POST /worker/restart` — Restart all workers
- `POST /worker/set-count` — Change worker pool size
- `GET /logs` — Filterable log export (level, source, limit, offset)
- `GET /health` — DB ping, queue check, worker count

**Plugins** (`/plugins`):
- `GET /` — List all plugins sorted by priority
- `POST /` — Create plugin (validates PluginType)
- `PATCH /{id}` — Update plugin (reloads manager)
- `DELETE /{id}` — Delete plugin (unregisters)
- `POST /{id}/test` — HTTP GET to plugin endpoint

**Scheduler** (`/scheduler`):
- `GET /` — List all schedules
- `POST /` — Create schedule (calculates `next_run` from cron)
- `PATCH /{id}` — Update schedule (recalculates next_run)
- `DELETE /{id}` — Delete schedule
- `POST /{id}/run-now` — Execute schedule immediately

**Uploads** (`/uploads`):
- `GET /` — Paginated upload list
- `GET /history` — Upload history with success/fail counts
- `GET /{id}` — Single upload record
- `POST /youtube` — Trigger YouTube upload for a project

### 3.6 Domain Modules

**story_generator.py** — No LLM required. Template-driven with 6 story styles:
- `narrative`, `documentary`, `educational`, `cinematic`, `emotional`, `comedic`
- Each style has a fixed 7-section structure (Hook → Context → Build → Climax → Resolution → Reflection → CTA)
- 10 hook templates (e.g., "Have you ever wondered...?")
- `generate_story()` returns: title, hook, sections (with duration estimates), keywords, tags, hashtags, chapters with timestamps, SEO description, pinned comment, video category

**scene_generator.py** — Takes story sections → divides into scenes. Each scene has:
- narration (title + content), duration_seconds, camera_style (16 options), transition (12), music_mood (12), emotion (12), movement_style (16 including Ken Burns), sound_effect, animation_prompt, image_prompt

**image_generator.py** — `generate_scene_images()` per-scene:
1. **Primary**: Pollinations AI (`image.pollinations.ai/prompt/{encoded}?seed=N`)
2. **Fallback**: Puter AI (`api.puter.com/v2/images/generate` with dall-e-3)
3. **Last resort**: Pillow placeholder (dark gradient + scene number + prompt text)
- Prompt caching avoids regenerating duplicate images

**voice_generator.py** — `generate_voice()`:
1. **Piper TTS**: Local `piper` CLI with ONNX voice model (quality)
2. **Synthetic WAV**: numpy sine wave (180Hz carrier, 2.5Hz modulation, cosine envelope)
3. **Pure Python fallback**: If numpy unavailable

**subtitle_generator.py** — Generates 3 formats from scene data:
- SRT (SubRip), VTT (WebVTT), TXT with timestamps
- Timestamps calculated cumulatively from scene durations

**video_generator.py** — 3-tier rendering:
1. **MoviePy (best)**: ImageClips with Ken Burns animations, AudioFileClip, TextClip subtitles, libx264/aac
2. **FFmpeg concat (medium)**: Image list with durations, audio via -shortest
3. **FFmpeg simple (fallback)**: Images only, -preset ultrafast
- `generate_shorts()`: Finds dramatic scenes (climax/twist), crops to 1080×1920 (9:16)

**thumbnail_generator.py** — 1280×720 PNG via Pillow:
- Dark gradient background, amber accent bar, centered title, "Explore: {topic}" subtitle, "▶ WATCH NOW" rounded CTA button

**metadata_generator.py** — Structures YouTube SEO metadata JSON:
- title, description, keywords/tags/hashtags, category, pinned comment, visibility, upload config

### 3.7 Infrastructure Modules

**pollinations_client.py** — HTTP GET to `image.pollinations.ai/prompt/{prompt}?seed=N&width=1920&height=1080`. Retries 3× with exponential backoff (2s, 4s). Returns bytes or None.

**puter_client.py** — HTTP POST to `api.puter.com/v2/images/generate` with JSON payload `{prompt, width, height, model: "dall-e-3", n: 1}`. Fetches resulting URL. Retries 3×.

**plugin_manager.py** — Singleton `PluginManager`:
- Loads enabled plugins from DB ordered by priority
- `get_provider(type)` — returns highest-priority enabled plugin
- Hook system: `register_hook(name, callback)` / `trigger_hook(name, **kwargs)`

**scheduler_service.py** — `scheduler_loop(60s)` background task:
- Queries enabled schedules whose `next_run` is past (or null)
- For each: creates Project + enqueues it, updates `last_run`, recalculates `next_run`
- Cron parser handles `*/N` and simple minute/hour patterns

**upload_service.py** — **Simulated** YouTube upload:
- Generates fake `video_id` (`sim_{project_id}_{timestamp}`)
- Creates UploadLog row with status "completed"
- No actual YouTube Data API call

**logging_service.py** — Dual logging:
- File handler: `logs/app.log` with timestamps
- Database: `Log` table via `log_event(level, source, message, details, project_id)`
- `export_logs()` queries Log table with filters

### 3.8 All 17 Job States (in order)

```
 1. WAITING               — Initial state, queued for processing
 2. GENERATING_SCRIPT     — Stage 1
 3. GENERATING_METADATA   — Stage 2
 4. GENERATING_SCENES     — Stage 3
 5. GENERATING_IMAGES     — Stage 4
 6. GENERATING_VOICE      — Stage 5
 7. GENERATING_SUBTITLES  — Stage 6
 8. GENERATING_THUMBNAIL  — Stage 7
 9. EDITING_VIDEO         — Stage 8a
10. RENDERING             — Stage 8b
11. GENERATING_SHORTS     — Stage 9
12. UPLOADING             — Stage 10
13. COMPLETED             — Pipeline finished successfully
14. FAILED                — Exception at any stage
15. RETRYING              — Defined but not actively used
16. CANCELLED             — User cancelled
17. ARCHIVED              — User archived
```

States 2-12 are the "running" states. If the server restarts while a project is in any of these, it's marked FAILED on startup (crash recovery).

---

## 4. Frontend Architecture

### 4.1 Pages & Routes

All 13 routes use the Next.js 14 App Router (`app/` directory):

| Route | Page | Purpose |
|---|---|---|
| `/` | Dashboard | Home screen with hero, stats, quick-start form, activity, chart |
| `/guide` | Getting Started | Setup instructions with code blocks |
| `/projects` | Projects | Card grid with search/filter/actions |
| `/queue` | Queue | Real-time monitor with cancel/retry |
| `/settings` | Settings | 7-tab configuration page |
| `/system` | System | Health badge, CPU/memory/disk gauges, worker panel |
| `/logs` | Logs | Filterable log viewer with export |
| `/plugins` | Plugins | Plugin grid with install/test/toggle |
| `/calendar` | Calendar | Schedule CRUD with cron presets |
| `/uploads` | Uploads | Upload history + YouTube upload trigger |
| `/media` | Media Library | Grid/list view of project files |
| `/api-keys` | API Management | Key generation/reveal/revoke |
| `/templates` | Templates | localStorage-backed template CRUD |

### 4.2 Sidebar Navigation

`Sidebar.tsx` — Collapsible sidebar (`w-60` expanded, `w-16` collapsed):

**Main section:**
- Dashboard (`/`), Getting Started (`/guide`), Calendar (`/calendar`), Queue (`/queue`), Projects (`/projects`)

**Content section:**
- Media (`/media`), Templates (`/templates`), Uploads (`/uploads`)

**System section:**
- Logs (`/logs`), Settings (`/settings`), API Management (`/api-keys`), Plugin Manager (`/plugins`), System Status (`/system`)

Active route detection via `usePathname()`. Toggle button at `-right-3 top-14`. Bottom status bar shows green pulse + "All Systems Go".

### 4.3 Dashboard

`Dashboard.tsx` — The most complex component (~513 lines):

- **Hero**: Gradient card with AI logo, "Welcome to AI YouTube Factory", 4 feature badges
- **Stat Cards**: 6 cards (Upcoming, Completed, Running, Queue Size, CPU, Memory) with animated values, skeleton loading, trend badges
- **Workers Status**: Progress bar with active/idle counts, individual worker badges
- **Quick Start Form**: Topic (input), Summary (textarea), Language (select, 12 options), Target Audience (6), Duration (3), Voice Style (4), Story Style (6). Submit → `createProject()` → toast feedback
- **Activity Feed**: Last 8 projects with status icons (check/alert/spinner/clock)
- **Monthly Chart**: Vertical bar chart, last 6 months, gradient bars
- **Polling**: Every 5 seconds

### 4.4 API Client

`lib/api.ts` — 69-line typed wrapper around fetch:

```typescript
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
async function request<T>(path, options?) { ... }
```

All 25+ endpoint functions:
- `getProjects(params?)`, `getProject(id)`, `createProject(data)`, `deleteProject(id)`, `duplicateProject(id)`, `cancelProject(id)`, `archiveProject(id)`, `rerenderProject(id)`, `getProjectFiles(id)`, `getProjectLogs(id)`
- `getSettings()`, `updateSettings(data)`, `getSetting(key)`, `updateSetting(key, value)`
- `getQueueStatus()`, `getActiveJobs()`, `clearQueue()`, `retryJob(id)`
- `getSystemStatus()`, `getSystemStats()`, `getWorkerStatus()`, `getSystemLogs()`, `restartWorkers()`, `setWorkerCount(count)`
- `getPlugins()`, `createPlugin(data)`, `updatePlugin(id, data)`, `deletePlugin(id)`, `testPlugin(id)`
- `getSchedules()`, `createSchedule(data)`, `updateSchedule(id, data)`, `deleteSchedule(id)`, `runScheduleNow(id)`
- `getUploads()`, `getUploadHistory()`, `getUpload(id)`, `uploadToYoutube(projectId)`
- `getHealth()`

### 4.5 Styling System

Built on TailwindCSS with custom utilities in `globals.css`:

**Component utilities:**
- `.glass` — `bg-neutral-900/70 backdrop-blur-xl border border-neutral-800/50`
- `.card` — `bg-card border border-border rounded-xl`
- `.input-field` — Dark input with focus ring
- `.btn-primary` — Accent button with press effect (`active:scale-[0.98]`)
- `.btn-ghost` — Transparent button with hover background
- `.skeleton` — `bg-neutral-800/50 rounded-lg animate-pulse`
- `.shimmer` — Animated gradient loading effect
- `.progress-bar` / `.progress-fill` — Thin rounded progress bars

**Visual language:**
- Dark theme throughout (`bg-neutral-950`, `text-foreground`)
- Glassmorphism: blurred backgrounds, subtle borders, transparency
- Gradients: hero cards, charts, buttons, worker bars
- Soft shadows: cards, modals, dropdowns
- Framer Motion: staggered mount animations, hover effects, transitions
- All transitions: `duration-200` or `duration-300`
- Text gradient utility: `text-gradient` (blue → purple → pink)

### 4.6 State Management

**No external state library** — purely React built-ins:

- **useState**: Each page manages its own local state. Typical patterns: `[projects, setProjects]`, `[loading, setLoading]`, `[modalOpen, setModalOpen]`
- **useEffect**: Data fetching on mount + polling intervals:
  - Dashboard: 5s, Queue: 3s, Logs: 5s, Calendar: 15s, Uploads: 10s, System: 10s, Projects: 5s
- **useCallback**: Wraps fetch functions to avoid re-creation on re-renders
- **useMemo**: Derived data (filtered logs, monthly stats, grouped media files)
- **Toaster**: Module-level function reference (`addToastFn`). `toast.success()`, `toast.error()`, `toast.info()`. Auto-dismiss after 4 seconds
- **No Context, Redux, or React Query** — data is fetched directly and stored locally. Polling acts as a simple real-time refresh mechanism

---

## 5. End-to-End Flow

```
Browser                          Backend                         File System
   │                                │                                │
   │── POST /projects ──────────────▶│                                │
   │   {topic, summary, ...}        │                                │
   │                                ├── Create DB row (WAITING)     │
   │                                ├── Enqueue job                 │
   │◀── { project_id, ... } ────────┤                                │
   │                                │                                │
   │── WS /ws/{id} ────────────────▶│                                │
   │                                │                                │
   │                                │── Worker picks up job         │
   │                                │── run_pipeline():             │
   │                                │   1. Generate Story           │── script/story.json
   │◀── status=GENERATING_SCRIPT ───┤                                │
   │                                │   2. Generate Metadata        │── metadata/metadata.json
   │◀── status=GENERATING_METADATA ─┤                                │
   │                                │   3. Generate Scenes          │── script/scenes.json
   │◀── status=GENERATING_SCENES ───┤                                │
   │                                │   4. Generate Images          │── images/001.png, ...
   │◀── status=GENERATING_IMAGES ───┤                                │
   │                                │   5. Generate Voice           │── voice/voice.wav
   │◀── status=GENERATING_VOICE ────┤                                │
   │                                │   6. Generate Subtitles       │── subtitles/*.srt, .vtt, .txt
   │◀── status=GENERATING_SUBTITLES─┤                                │
   │                                │   7. Generate Thumbnail       │── thumbnail/thumbnail.png
   │◀── status=GENERATING_THUMBNAIL─┤                                │
   │                                │   8. Render Video             │── video/final.mp4
   │◀── status=EDITING_VIDEO ───────┤                                │
   │◀── status=RENDERING ───────────┤                                │
   │                                │   9. Generate Shorts          │── shorts/short.mp4
   │◀── status=GENERATING_SHORTS ───┤                                │
   │                                │  10. Upload                   │── UploadLog row
   │◀── status=UPLOADING ───────────┤                                │
   │                                │  11. Complete                 │
   │◀── status=COMPLETED, 100% ─────┤                                │
   │                                │                                │
   │── GET /projects/{id}/files ───▶│                                │
   │◀── [{name,size,path}, ...] ────┤                                │
   │── GET /projects/{id}/download ▶│── zip archive ──────────────────│
   │◀── ZIP file ──────────────────┤                                │
```

---

## 6. Error Handling

### Backend Error Handling

**Project Pipeline**: Each stage wrapped in try/except. On exception:
1. Status set to FAILED
2. Error logged to `project.logs` JSON array (stored in DB)
3. Error logged to Log table via `logging_service.log_event()`
4. Error logged to file (`logs/app.log`)
5. Exception re-raised → caught by worker_loop → marks project FAILED

**Crash Recovery**: On startup, `recover_interrupted_jobs()` sets any project in a running state to FAILED.

**HTTP Errors**: All routers return `HTTPException` with appropriate status codes:
- 404 for missing resources
- 400 for validation errors
- 500 for unexpected server errors

**Queue Errors**: Worker loop catches `CancelledError` (→ CANCELLED), `asyncio.TimeoutError`, and generic `Exception` (→ FAILED).

**External API failures**: Image generation has 3-tier fallback (Pollinations → Puter → Pillow placeholder). Voice has 2-tier (Piper → synthetic WAV). Video has 3-tier (MoviePy → FFmpeg concat → FFmpeg simple).

### Frontend Error Handling

**Loading States**: Every page has skeleton loading UI (`className="skeleton"`) while data loads.

**Error States**: Centered error card with `AlertCircle` icon, descriptive message, and Retry button.

**Empty States**: Context-appropriate empty messages:
- "No projects yet" (Dashboard) vs "No matching projects" (Projects with filters)
- "Complete a video project first" (Uploads)
- "No media files yet" (Media)
- "No logs recorded yet" (Logs)

**Toast Notifications**: `toast.success()`, `toast.error()`, `toast.info()` for all actions. Auto-dismiss 4s.

**API Errors**: `request<T>()` throws on non-ok responses. Pages catch these in their fetch functions and set error state.

**TypeScript**: `strict: true` in tsconfig.json. Many `any` types used for simplicity. `.eslintrc.json` suppresses common lint warnings that don't affect runtime.

**Build errors**: If `npx next build` fails, check:
1. **Undefined variable** — "Cannot find name 'X'" — usually a missing import from lucide-react
2. **Type error** — "Type 'X' is not assignable to type 'Y'" — incorrect prop type
3. **Syntax error** — "Expected ';', '}' or <eof>" — corrupted file (check for appended/duplicated text)

---

## 7. How to Debug Errors

### Backend Errors

1. Check terminal output — the backend logs everything to stdout with timestamps and log levels
2. Check `backend/logs/app.log` — persistent file log
3. Check the Logs page on the frontend (`/logs`) — filterable, searchable
4. For pipeline failures, check the Project's logs (`GET /projects/{id}/logs`)
5. Hit `GET /health` to verify the backend is running
6. Hit `GET /system/stats` to verify workers and queue are active
7. If database is corrupted, delete `backend/aiyoutube.db` and restart (tables auto-create)

### Common Backend Issues

| Symptom | Likely Cause |
|---|---|
| `ModuleNotFoundError: No module named 'sqlalchemy'` | Not running inside venv — activate it first |
| `sqlite3.OperationalError: no such table` | DB not initialized — restart, init_db runs on startup |
| Workers not starting | Port conflict — check port 8000 |
| Images not generating | Pollinations API down / no internet — falls back to Puter, then placeholder |
| Video rendering fails | FFmpeg not installed or not in PATH |

### Frontend Errors

1. Check browser DevTools console (F12 → Console tab) for network errors and React errors
2. Check browser DevTools Network tab to see API calls and their responses
3. Run `npm run dev` in a visible terminal to see compile errors
4. If the page shows "Something went wrong" with "Failed to fetch", the backend is down — start it

### Common Frontend Issues

| Symptom | Likely Cause |
|---|---|
| "Failed to fetch" | Backend not running on port 8000 |
| "Cannot find name 'X'" | Missing lucide-react import (add to the import line) |
| White screen / blank page | JavaScript runtime error — check console |
| Stale data | Polling interval hasn't fired yet — wait or refresh |
| Build fails with type error | Check strict TypeScript compatibility |
| Styles broken | Tailwind classes misspelled or not matching utilities |
