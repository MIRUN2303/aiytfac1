---
title: AI YouTube Factory Backend
emoji: 🎬
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
app_port: 7860
---

# AI YouTube Factory 🎬

**Autonomous Content Creation Platform** — Generate cinematic storytelling videos from just a **Topic** and **Summary**.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/)
[![Python](https://img.shields.io/badge/python-3.12-blue)](https://python.org)
[![Next.js](https://img.shields.io/badge/next.js-14-black)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/fastapi-0.137-green)](https://fastapi.tiangolo.com)

---

## ✨ Features

- **🤖 AI Story Generation** — Auto-generates scripts, hooks, scenes, and chapters
- **🎨 Image Generation** — Pollinations AI + Puter.js fallback with retry logic
- **🗣️ Voice Narration** — Piper TTS integration with multiple voices
- **📝 Subtitles** — Auto-generated SRT, VTT, and TXT files
- **🎬 Video Editing** — Cinematic effects: Ken Burns, crossfade, zoom, parallax
- **📱 Shorts Generator** — Vertical 1080×1920 videos for YouTube/Instagram/Facebook
- **🖼️ Thumbnails** — Auto-generated PNG with text overlay
- **📊 Dashboard** — Real-time progress monitoring with live updates
- **📅 Scheduler** — Daily/weekly/monthly automatic content publishing
- **🔌 Plugin System** — Extensible architecture for custom providers
- **☁️ Docker Support** — One-command deployment
- **🔒 Production Ready** — Async, retry, crash recovery, checkpoint system

## 🚀 Quick Start

```bash
# Backend
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** — Enter a Topic and Summary, and let AI do the rest.

## 🏗️ Architecture

```
User Input (Topic + Summary)
        ↓
  ┌─────────────┐
  │ Story Gen   │ → Script, Hook, Chapters, CTA
  └─────────────┘
        ↓
  ┌─────────────┐
  │ Scene Gen   │ → Split into scenes with prompts
  └─────────────┘
        ↓
  ┌─────────────┐
  │ Image Gen   │ → Pollinations → Puter → Placeholder
  └─────────────┘
        ↓
  ┌─────────────┐
  │ Voice Gen   │ → Piper TTS → WAV export
  └─────────────┘
        ↓
  ┌─────────────┐
  │ Subtitle Gen│ → SRT, VTT, TXT
  └─────────────┘
        ↓
  ┌─────────────┐
  │ Video Gen   │ → MoviePy/FFmpeg → MP4
  └─────────────┘
        ↓
  ┌─────────────┐
  │ Upload      │ → YouTube (optional)
  └─────────────┘
        ↓
     Complete!
```

## 📋 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS, Framer Motion |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Pydantic |
| Database | SQLite (with easy PostgreSQL migration) |
| Queue | AsyncIO-based worker system |
| Video | MoviePy, FFmpeg |
| Voice | Piper TTS |
| Subtitles | Whisper |
| Image Gen | Pollinations AI, Puter.js |
| Deployment | Docker, Docker Compose |

## 📖 Documentation

- [Installation Guide](INSTALL.md)
- [API Documentation](http://localhost:8000/docs)
- [Architecture Overview](ARCHITECTURE.md)

## 📁 Project Structure

```
├── backend/
│   ├── application/      # Pipeline orchestration
│   ├── domain/           # Business logic (story, scenes, images, etc.)
│   ├── infrastructure/   # External services (Pollinations, Puter, Scheduler)
│   ├── routers/          # FastAPI route handlers
│   └── tests/            # 27 passing tests
├── frontend/
│   ├── src/app/          # 10+ pages (Dashboard, Queue, Projects, etc.)
│   ├── src/components/   # Reusable UI components
│   └── src/lib/          # API client
├── projects/             # Generated video output
├── docker-compose.yml    # Production deployment
└── .env.example          # Environment template
```

## 🧪 Tests

```bash
cd backend
pytest tests/ -v  # 27 tests, all passing
```

## 📄 License

MIT
