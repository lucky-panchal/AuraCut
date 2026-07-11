# Auracut

A browser-based, zero-cost multi-track video editor built with **Django + React**.  
Full NLE (non-linear editor) that runs entirely in the browser — multi-track timeline, real-time hybrid preview, server-side FFmpeg export, and live progress streaming over WebSockets.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Zustand, Axios, dnd-kit, Fabric.js |
| Backend | Django 4.2, Django REST Framework, Daphne (ASGI) |
| Real-time | Django Channels 4, Redis 7 (channel layer) |
| Task Queue | Celery 5, Redis 7 (broker) |
| Database | PostgreSQL 15 |
| Video Processing | FFmpeg (bundled in container), MoviePy, Pillow |
| Auth | JWT via `djangorestframework-simplejwt` |
| Infrastructure | Docker, Docker Compose |

---

## Architecture Overview

```mermaid
graph TB
    subgraph Browser["🌐 Browser (localhost:5173)"]
        FE["React + TypeScript<br/>Vite Dev Server"]
    end

    subgraph Backend["🐍 Backend (localhost:8000)"]
        DAPHNE["Daphne ASGI Server"]
        HTTP["HTTP — Django REST API<br/>/api/"]
        WS["WebSocket — Django Channels<br/>/ws/"]
    end

    subgraph Worker["⚙️ Celery Worker"]
        TASKS["Background Tasks<br/>asset processing · preview · export"]
    end

    subgraph Infra["🗄️ Infrastructure"]
        PG["PostgreSQL 15<br/>postgres_data volume"]
        REDIS["Redis 7<br/>broker + channel layer"]
        MEDIA["media_files volume<br/>uploads · proxies · exports"]
    end

    FE -- "REST /api/ (Axios + JWT)" --> HTTP
    FE -- "WebSocket /ws/ (useWebSocket hook)" --> WS
    HTTP --> PG
    WS --> REDIS
    HTTP --> TASKS
    TASKS --> REDIS
    TASKS --> PG
    TASKS --> MEDIA
    DAPHNE --> HTTP
    DAPHNE --> WS
    Backend --> MEDIA
```

---

## Full File Connection Map

```mermaid
graph LR
    subgraph FE_Entry["Frontend Entry"]
        MAIN["main.tsx"]
        APP["App.tsx"]
        ROUTER["router.tsx"]
    end

    subgraph FE_Pages["Pages / Features"]
        LOGIN["LoginPage.tsx"]
        REGISTER["RegisterPage.tsx"]
        PROFILE["ProfilePage.tsx"]
        DASHBOARD["DashboardPage.tsx"]
        PROJCARD["ProjectCard.tsx"]
        EDITOR["EditorPage.tsx"]
    end

    subgraph FE_Editor["Editor Panels"]
        MEDIA_P["MediaPanel.tsx"]
        ASSET_ITEM["AssetItem.tsx"]
        PREVIEW_P["PreviewPanel.tsx"]
        PREVIEW_C["PreviewCanvas.tsx"]
        TIMELINE["Timeline.tsx"]
        TRACK["Track.tsx"]
        CLIP["Clip.tsx"]
        PLAYHEAD["Playhead.tsx"]
        TIMERULER["TimeRuler.tsx"]
        SNAP["SnapEngine.ts"]
        EFFECTS["EffectsPanel.tsx"]
        COLOR["ColorFilterSliders.tsx"]
        SUBTITLE["SubtitleEditor.tsx"]
        TEXTFORM["TextOverlayForm.tsx"]
        EXPORTMODAL["ExportModal.tsx"]
        EXPORTPROG["ExportProgress.tsx"]
    end

    subgraph FE_API["API Layer"]
        CLIENT["client.ts<br/>(Axios + JWT interceptors)"]
        API_AUTH["auth.ts"]
        API_PROJ["projects.ts"]
        API_ASSETS["assets.ts"]
        API_EXPORT["export.ts"]
    end

    subgraph FE_Store["Zustand Stores"]
        AUTH_STORE["useAuthStore.ts"]
        PROJ_STORE["useProjectStore.ts"]
        TL_STORE["useTimelineStore.ts"]
        PREV_STORE["usePreviewStore.ts"]
    end

    subgraph FE_Hooks["Hooks"]
        WS_HOOK["useWebSocket.ts"]
        AUTOSAVE["useAutoSave.ts"]
    end

    subgraph FE_Types["Types"]
        TYPES["types/index.ts"]
    end

    MAIN --> APP --> ROUTER
    ROUTER --> LOGIN & REGISTER & PROFILE & DASHBOARD & EDITOR

    DASHBOARD --> PROJCARD
    DASHBOARD --> API_PROJ
    DASHBOARD --> AUTH_STORE

    EDITOR --> MEDIA_P & PREVIEW_P & TIMELINE & EFFECTS & EXPORTMODAL
    MEDIA_P --> ASSET_ITEM
    MEDIA_P --> API_ASSETS
    PREVIEW_P --> PREVIEW_C
    TIMELINE --> TRACK --> CLIP
    TIMELINE --> PLAYHEAD & TIMERULER & SNAP
    EFFECTS --> COLOR & SUBTITLE & TEXTFORM
    EXPORTMODAL --> EXPORTPROG
    EXPORTMODAL --> API_EXPORT

    EDITOR --> TL_STORE & PROJ_STORE & PREV_STORE
    EDITOR --> AUTOSAVE & WS_HOOK

    AUTOSAVE --> TL_STORE
    AUTOSAVE --> PROJ_STORE
    AUTOSAVE --> API_PROJ

    LOGIN & REGISTER --> API_AUTH --> CLIENT
    API_PROJ & API_ASSETS & API_EXPORT --> CLIENT
    CLIENT --> AUTH_STORE

    TL_STORE --> TYPES
    PREV_STORE --> TYPES
    PROJ_STORE --> TYPES
    AUTH_STORE --> TYPES
```

---

## Backend File Connection Map

```mermaid
graph LR
    subgraph BE_Entry["Entry Points"]
        ASGI["asgi.py<br/>ProtocolTypeRouter"]
        WSGI["wsgi.py"]
        MANAGE["manage.py"]
        CELERY_APP["celery.py<br/>Celery app"]
    end

    subgraph BE_Config["Config"]
        URLS["config/urls.py<br/>root URL router"]
        ROUTING["config/routing.py<br/>WebSocket URL router"]
        SETTINGS_BASE["settings/base.py"]
        SETTINGS_DEV["settings/development.py"]
        SETTINGS_PROD["settings/production.py"]
    end

    subgraph BE_Core["Core"]
        BASE_MODEL["core/models.py<br/>BaseModel (UUID + timestamps)"]
        PERMS["core/permissions.py"]
        VALIDATORS["core/validators.py"]
        EXCEPTIONS["core/exceptions.py"]
    end

    subgraph BE_Accounts["accounts app"]
        ACC_MODEL["accounts/models.py<br/>UserProfile"]
        ACC_SER["accounts/serializers.py"]
        ACC_VIEWS["accounts/views.py<br/>register · login · refresh · profile"]
        ACC_URLS["accounts/urls.py"]
    end

    subgraph BE_Projects["projects app"]
        PROJ_MODEL["projects/models.py<br/>Project"]
        PROJ_SER["projects/serializers.py"]
        PROJ_VIEWS["projects/views.py"]
        PROJ_URLS["projects/urls.py"]
        PROJ_SVC["projects/services.py"]
        PROJ_CON["projects/consumers.py<br/>ProjectConsumer (WS)"]
    end

    subgraph BE_Assets["assets app"]
        ASSET_MODEL["assets/models.py<br/>MediaAsset"]
        ASSET_SER["assets/serializers.py"]
        ASSET_VIEWS["assets/views.py"]
        ASSET_URLS["assets/urls.py"]
        ASSET_SVC["assets/services.py"]
        ASSET_TASKS["assets/tasks.py<br/>process_asset_task"]
    end

    subgraph BE_Preview["preview app"]
        PREV_CON["preview/consumers.py<br/>PreviewConsumer (WS)"]
        PREV_TASKS["preview/tasks.py<br/>render_preview_task"]
    end

    subgraph BE_Export["export app"]
        EXP_MODEL["export/models.py<br/>ExportJob"]
        EXP_SER["export/serializers.py"]
        EXP_VIEWS["export/views.py"]
        EXP_URLS["export/urls.py"]
        EXP_SVC["export/services.py"]
        EXP_TASKS["export/tasks.py<br/>export_task"]
        EXP_FFMPEG["export/ffmpeg.py<br/>FFmpegCommandBuilder"]
        EXP_CON["export/consumers.py<br/>ExportConsumer (WS)"]
    end

    ASGI --> URLS & ROUTING
    ROUTING --> PROJ_CON & PREV_CON & EXP_CON
    URLS --> ACC_URLS & PROJ_URLS & ASSET_URLS & EXP_URLS

    ACC_URLS --> ACC_VIEWS --> ACC_SER --> ACC_MODEL --> BASE_MODEL
    PROJ_URLS --> PROJ_VIEWS --> PROJ_SER --> PROJ_MODEL --> BASE_MODEL
    ASSET_URLS --> ASSET_VIEWS --> ASSET_SER --> ASSET_MODEL --> BASE_MODEL
    EXP_URLS --> EXP_VIEWS --> EXP_SER --> EXP_MODEL --> BASE_MODEL

    ASSET_VIEWS --> ASSET_SVC --> ASSET_TASKS
    EXP_VIEWS --> EXP_SVC --> EXP_TASKS --> EXP_FFMPEG
    EXP_TASKS --> EXP_CON
    ASSET_TASKS --> ASSET_MODEL
    PREV_TASKS --> PREV_CON

    PROJ_VIEWS --> PERMS
    ASSET_VIEWS --> VALIDATORS
    EXP_VIEWS --> EXCEPTIONS

    CELERY_APP --> ASSET_TASKS & PREV_TASKS & EXP_TASKS
    SETTINGS_DEV --> SETTINGS_BASE
    SETTINGS_PROD --> SETTINGS_BASE
```

---

## Data Flow Diagrams

### Asset Upload Flow

```mermaid
sequenceDiagram
    participant U as Browser
    participant API as Django REST API
    participant DB as PostgreSQL
    participant Q as Redis (Celery)
    participant W as Celery Worker
    participant FS as media_files volume
    participant WS as WebSocket

    U->>API: POST /api/projects/{id}/assets/ (multipart)
    API->>FS: Save original file
    API->>DB: Create MediaAsset (status=uploading)
    API->>Q: Queue process_asset_task(asset_id)
    API-->>U: 201 Created {asset_id, status: "uploading"}
    Q->>W: Deliver task
    W->>DB: Update status=processing
    W->>FS: Run ffprobe (metadata extraction)
    W->>FS: Generate 480p proxy + thumbnail
    W->>DB: Update status=ready + metadata
    W->>WS: Notify client via ProjectConsumer
    WS-->>U: {event: "asset_ready", asset_id}
```

### Export Flow

```mermaid
sequenceDiagram
    participant U as Browser
    participant API as Django REST API
    participant DB as PostgreSQL
    participant Q as Redis (Celery)
    participant W as Celery Worker
    participant FFmpeg as FFmpeg subprocess
    participant WS as WebSocket (ExportConsumer)

    U->>WS: Connect /ws/export/{job_id}/
    U->>API: POST /api/export/ {resolution, format, fps, bitrate}
    API->>DB: Create ExportJob (status=queued)
    API->>Q: Queue export_task(job_id)
    API-->>U: 201 {job_id}
    Q->>W: Deliver task
    W->>DB: Update status=processing
    W->>DB: Fetch timeline_state JSON
    W->>FFmpeg: Build + run filter_complex command
    loop Progress streaming
        FFmpeg-->>W: stderr (out_time_ms=...)
        W->>DB: update_progress(%)
        W->>WS: group_send export_{job_id} {event: progress, value: %}
        WS-->>U: {event: "progress", value: 42}
    end
    FFmpeg-->>W: exit 0
    W->>DB: mark_completed(output_path)
    W->>WS: group_send {event: "completed", download_url}
    WS-->>U: {event: "completed", download_url: "/media/exports/..."}
```

### Auto-Save Flow

```mermaid
sequenceDiagram
    participant User as User Action
    participant TL as useTimelineStore
    participant AS as useAutoSave hook
    participant API as projects.ts API
    participant BE as Django PATCH /api/projects/{id}/

    User->>TL: addClip / moveClip / trimClip / etc.
    TL->>TL: isDirty = true (push to undo history)
    TL-->>AS: isDirty changed
    AS->>AS: debounce 5 seconds
    AS->>API: saveTimelineState(projectId, snapshot)
    API->>BE: PATCH {timeline_state: {...}}
    BE-->>API: 200 OK
    API-->>AS: success
    AS->>TL: markClean()
    AS->>ProjectStore: setSaveStatus("saved")
```

---

## Database Schema

```mermaid
erDiagram
    User {
        int id PK
        string username
        string email
        string password
    }
    UserProfile {
        uuid id PK
        int user_id FK
        string display_name
        string avatar
        datetime created_at
        datetime updated_at
    }
    Project {
        uuid id PK
        int owner_id FK
        string name
        json timeline_state
        string thumbnail
        bool is_deleted
        datetime deleted_at
        datetime created_at
        datetime updated_at
    }
    MediaAsset {
        uuid id PK
        uuid project_id FK
        string filename
        string asset_type
        string file_path
        string proxy_path
        string thumbnail_path
        float duration
        string resolution
        float fps
        string codec
        bigint file_size
        string status
        string error_message
        datetime created_at
        datetime updated_at
    }
    ExportJob {
        uuid id PK
        uuid project_id FK
        int user_id FK
        string resolution
        string format
        string bitrate
        int fps
        bool subtitle_burn_in
        string status
        int progress
        string output_path
        string error_message
        datetime completed_at
        datetime created_at
        datetime updated_at
    }

    User ||--|| UserProfile : "has one"
    User ||--o{ Project : "owns"
    Project ||--o{ MediaAsset : "contains"
    Project ||--o{ ExportJob : "has"
    User ||--o{ ExportJob : "triggers"
```

---

## WebSocket Channels

| Path | Consumer | Purpose |
|---|---|---|
| `/ws/project/{project_id}/` | `ProjectConsumer` | Real-time project state sync, asset ready notifications |
| `/ws/preview/{project_id}/` | `PreviewConsumer` | Single-frame preview render results |
| `/ws/export/{job_id}/` | `ExportConsumer` | Export progress (0–100%) and completion/failure events |

---

## REST API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register/` | Create account |
| `POST` | `/api/auth/login/` | Obtain JWT pair |
| `POST` | `/api/auth/refresh/` | Refresh access token |
| `GET/PATCH` | `/api/auth/profile/` | Get or update user profile |
| `GET/POST` | `/api/projects/` | List or create projects |
| `GET/PATCH/DELETE` | `/api/projects/{id}/` | Retrieve, update, or soft-delete a project |
| `GET/POST` | `/api/projects/{id}/assets/` | List or upload assets for a project |
| `GET/DELETE` | `/api/assets/{id}/` | Retrieve or delete an asset |
| `GET/POST` | `/api/export/` | List or create export jobs |
| `GET` | `/api/export/{id}/` | Get export job status |

---

## Project Structure

```
auracut/
├── backend/
│   ├── apps/
│   │   ├── accounts/       # User auth + profile (JWT)
│   │   ├── assets/         # Media upload, ffprobe, proxy generation
│   │   ├── export/         # FFmpeg export pipeline + WebSocket progress
│   │   ├── preview/        # Single-frame preview rendering
│   │   └── projects/       # Project CRUD + timeline state storage
│   ├── config/
│   │   ├── settings/       # base / development / production
│   │   ├── asgi.py         # Daphne entry point (HTTP + WS)
│   │   ├── celery.py       # Celery app config
│   │   ├── routing.py      # WebSocket URL patterns
│   │   └── urls.py         # Root HTTP URL patterns
│   ├── core/
│   │   ├── models.py       # BaseModel (UUID pk, created_at, updated_at)
│   │   ├── permissions.py  # IsOwner permission class
│   │   ├── validators.py   # File type + size validators
│   │   └── exceptions.py   # Custom DRF exception handler
│   ├── Dockerfile
│   ├── entrypoint.sh       # wait-for-db → migrate → collectstatic → daphne
│   └── requirements.txt
├── frontend/
│   └── src/src/
│       ├── api/            # Axios client + typed API functions per domain
│       ├── components/     # Button, Modal, ProgressBar, Spinner, Toast
│       ├── features/
│       │   ├── auth/       # LoginPage, RegisterPage, ProfilePage
│       │   ├── dashboard/  # DashboardPage, ProjectCard
│       │   └── editor/     # EditorPage + all sub-panels
│       │       ├── EffectsPanel/   # Color filters, subtitles, text overlays
│       │       ├── ExportModal/    # Export settings + progress display
│       │       ├── MediaPanel/     # Asset browser + upload
│       │       ├── PreviewPanel/   # Fabric.js canvas preview
│       │       └── Timeline/       # Multi-track timeline, clips, snap engine
│       ├── hooks/
│       │   ├── useAutoSave.ts      # Debounced 5s auto-save to backend
│       │   └── useWebSocket.ts     # Reconnecting WebSocket with exp. backoff
│       ├── store/
│       │   ├── useAuthStore.ts     # JWT tokens + user state
│       │   ├── usePreviewStore.ts  # Preview frame state
│       │   ├── useProjectStore.ts  # Active project + save status
│       │   └── useTimelineStore.ts # Full NLE state + undo/redo (50 steps)
│       ├── types/index.ts          # All shared TypeScript interfaces
│       └── router.tsx              # React Router v7 route definitions
├── .env.example
└── docker-compose.yml
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Docker | 24+ |
| Docker Compose | v2+ |
| FFmpeg | bundled inside backend container — not needed on host |

---

## Quick Start

```bash
# 1. Clone
git clone <repo-url>
cd auracut

# 2. Configure environment
cp .env.example .env
# Edit .env — set a strong SECRET_KEY at minimum

# 3. Start all services
docker compose up --build
```

| URL | Service |
|---|---|
| http://localhost:5173 | Frontend (Vite dev server) |
| http://localhost:8000 | Backend API (Daphne ASGI) |

```bash
# Stop (keep data)
docker compose down

# Stop + wipe all data
docker compose down -v
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key — **change before any deployment** |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | PostgreSQL credentials |
| `REDIS_URL` | Redis broker URL (default: `redis://redis:6379`) |
| `MEDIA_ROOT` | Absolute path for uploaded media inside the container |
| `MAX_UPLOAD_SIZE` | Max file upload size in bytes (default: 2 GB) |
| `BACKEND_PORT` | Host port for the backend (default: `8000`) |
| `FRONTEND_PORT` | Host port for the frontend (default: `5173`) |

---

## Key Design Decisions

- **Timeline as JSON** — `Project.timeline_state` stores the full NLE state as a single `JSONField`. Avoids over-normalizing a deeply nested, frequently mutated structure and enables instant undo/redo snapshots on the client.
- **Proxy-first preview** — uploaded videos are transcoded to 480p proxies by the Celery worker. The editor always uses proxies for smooth playback; the original file is only used during final export.
- **Undo/redo on the client** — `useTimelineStore` maintains a 50-step history stack entirely in memory. No round-trips to the server for undo/redo.
- **Auto-save with debounce** — `useAutoSave` waits 5 seconds after the last change before persisting to the backend, with 3 automatic retries on failure.
- **WebSocket reconnection** — `useWebSocket` implements exponential backoff (up to 5 attempts) before surfacing a toast error to the user.
- **Soft deletes** — projects are never hard-deleted; `is_deleted` + `deleted_at` flags allow future recovery.
