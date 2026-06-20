# AI YouTube Factory - Installation Guide

## Prerequisites

- Python 3.12+
- Node.js 20+
- FFmpeg
- Git

## Quick Start (Development)

### 1. Clone and Setup Backend

```bash
# Clone the repository
git clone <repo-url>
cd ai-youtube-factory

# Setup Python virtual environment
cd backend
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate
# Activate (Mac/Linux)
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations (auto-creates tables on startup)
# Start the backend
uvicorn main:app --reload --port 8000
```

### 2. Setup Frontend

```bash
# In a new terminal
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## Docker Deployment

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `POLLINATIONS_ENDPOINT` | Pollinations AI API endpoint | `https://image.pollinations.ai/prompt/` |
| `RETRY_DELAY` | Delay between retries (seconds) | `60` |
| `MAX_RETRIES` | Maximum retry attempts | `3` |
| `WORKER_COUNT` | Number of background workers | `3` |
| `FFMPEG_PATH` | Path to FFmpeg executable | `ffmpeg` |
| `LOG_LEVEL` | Logging level | `INFO` |

### External Dependencies (Optional)

The following tools enhance functionality but are optional:

- **Piper TTS**: Voice generation. Download from https://github.com/rhasspy/piper
- **Whisper**: Subtitle generation. Install via `pip install openai-whisper`
- **FFmpeg**: Video processing. Required for video rendering.

## Project Structure

```
ai-youtube-factory/
├── backend/           # Python FastAPI backend
│   ├── application/   # Business logic / pipeline
│   ├── domain/        # Domain services
│   ├── infrastructure/# External integrations
│   ├── routers/       # API endpoints
│   └── tests/         # Test suite
├── frontend/          # Next.js frontend
│   └── src/
│       ├── app/       # Pages (App Router)
│       ├── components/# React components
│       └── lib/       # API client
├── projects/          # Generated video projects
├── docker-compose.yml # Docker orchestration
└── .env.example       # Environment template
```

## Running Tests

```bash
# Backend tests
cd backend
pytest tests/ -v

# Frontend tests (if configured)
cd frontend
npm test
```
