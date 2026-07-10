# Auracut

A browser-based, zero-cost multi-track video editor built with Django + React.

---

## Overview

Auracut is a full-stack NLE (non-linear editor) that runs entirely in the browser.
It supports multi-track timeline editing, real-time hybrid preview, per-user project
workspaces, server-side FFmpeg export, and live progress streaming over WebSockets.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Docker | 24+ |
| Docker Compose | v2+ |
| FFmpeg | bundled inside backend container |

FFmpeg is installed automatically inside the backend Docker image — you do not need
it on your host machine.

---

## Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd auracut

# 2. Create your environment file
cp .env.example .env
# Edit .env and set a strong SECRET_KEY at minimum

# 3. Start all services
docker compose up --build
```

The first build takes a few minutes while Docker pulls images and installs
dependencies. On subsequent runs `docker compose up` starts in seconds.

| URL | Service |
|-----|---------|
| http://localhost:5173 | Frontend (Vite dev server) |
| http://localhost:8000 | Backend API (Daphne ASGI) |

---

## Environment Variables

All variables are defined in `.env.example`. Key ones:

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key — change before any deployment |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | PostgreSQL credentials |
| `REDIS_URL` | Redis broker URL (default: `redis://redis:6379`) |
| `MEDIA_ROOT` | Absolute path for uploaded media inside the container |
| `MAX_UPLOAD_SIZE` | Max file upload size in bytes (default: 2 GB) |
| `BACKEND_PORT` | Host port for the backend (default: `8000`) |
| `FRONTEND_PORT` | Host port for the frontend (default: `5173`) |

---

## Services

### `db` — PostgreSQL 15
Stores all application data: users, projects, timeline state (JSON), assets, export jobs.
Data is persisted in the `postgres_data` Docker volume.

### `redis` — Redis 7
Acts as the Celery task broker and Django Channels channel layer backend.
All WebSocket group messaging and async task queuing flows through Redis.

### `backend` — Django / Daphne ASGI
Runs the Django application via Daphne (ASGI server).
On startup the entrypoint script:
1. Waits for PostgreSQL to be ready
2. Runs `manage.py migrate`
3. Runs `manage.py collectstatic`
4. Starts Daphne on port 8000

Handles REST API (`/api/`), WebSocket consumers (`/ws/`), and media file serving (`/media/`).

### `worker` — Celery
Processes background tasks:
- Asset processing: `ffprobe` metadata extraction, 480p proxy generation, thumbnail extraction
- Preview rendering: single-frame FFmpeg render, result streamed back via WebSocket
- Export pipeline: full FFmpeg render with `filter_complex`, progress streamed via WebSocket

Shares the `media_files` volume with the backend service.

### `frontend` — Vite Dev Server (Node 20)
Serves the React + TypeScript frontend on port 5173.
Proxies `/api`, `/media`, and `/ws` requests to the backend service automatically
(configured in `vite.config.ts`).

---

## Project Structure

```
auracut/
├── backend/          # Django application
│   ├── apps/         # accounts, projects, assets, preview, export
│   ├── config/       # settings, urls, asgi, celery, routing
│   ├── core/         # BaseModel, permissions, validators, exceptions
│   └── requirements.txt
├── frontend/         # React + TypeScript (Vite)
│   └── src/src/
│       ├── api/      # Axios client + typed API functions
│       ├── features/ # auth, dashboard, editor panels
│       ├── hooks/    # useWebSocket, useAutoSave
│       ├── store/    # Zustand stores (auth, project, timeline, preview)
│       └── types/    # TypeScript interfaces
├── .env.example
└── docker-compose.yml
```

---

## Stopping

```bash
docker compose down          # stop containers, keep volumes
docker compose down -v       # stop containers and delete all data
```
