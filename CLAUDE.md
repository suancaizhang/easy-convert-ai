# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered document conversion platform. Users upload files (PDF, Word, Excel, PPT, images), choose a target format, and get back converted documents. Supports OCR via PaddleOCR-VL 1.6 cloud API.

Three services in one repo (not a package-manager monorepo):
- `web/` — Next.js 15 frontend (TypeScript, React 19, Tailwind CSS)
- `api/` — FastAPI backend (Python 3.11, SQLAlchemy 2.0, PostgreSQL, Alembic)
- `worker/` — Celery worker (Python 3.11, PyMuPDF, LibreOffice headless)

Orchestrated via `docker-compose.yml` with Redis as broker and PostgreSQL for persistence.

## Commands

### Frontend (`cd web/`)

```bash
npm run dev          # Next.js dev server on 0.0.0.0:3000
npm run build        # Production build (standalone output)
npm run lint         # ESLint via next lint
npm run test         # Vitest run (single pass)
npm run test:watch   # Vitest in watch mode
```

Single test file: `npx vitest run src/lib/i18n.test.tsx`

### API (`cd api/`)

```bash
pip install -r requirements.txt
alembic upgrade head                    # Run DB migrations
uvicorn app.main:app --reload --port 8111   # Local dev
```

New migration: `alembic revision --autogenerate -m "description"`

### Worker (`cd worker/`)

```bash
pip install -r requirements.txt
celery -A worker.celery_app worker --loglevel=info --concurrency=2 -Q default,office
```

The `-Q default,office` flag is critical — without it, Celery only listens on its default queue and misses all tasks.

### Full Stack (Docker)

```bash
cp .env.example .env   # Set JWT_SECRET at minimum
docker compose up --build
```

Services: web(:3000), api(:8000), worker, redis(:6379), postgres(:5432)

## Architecture

### Data Flow

```
User uploads file
  → API saves to /tmp/uploads (or /tmp/guest for anonymous)
  → API creates Document + Task in PostgreSQL
  → Celery dispatches to 'default' or 'office' queue
  → Worker converts, writes result to /tmp/convert_*
  → Worker updates Task status in DB
  → Frontend polls GET /api/tasks/{id}/status
  → On success, frontend calls download endpoint
```

### Frontend (web/src/)

- **App Router** pages: `/`, `/convert`, `/merge-images`, `/history`, `/login`, `/register`
- **Auth**: Custom React Context (`lib/auth.tsx`), JWT in localStorage, no external auth library
- **i18n**: Custom provider (`lib/i18n.tsx`), 7 languages (zh/en/th/vi/id/ms/fil), dictionaries in `i18n/`
- **API client** (`lib/api.ts`): fetch for JSON, XMLHttpRequest for uploads (progress tracking). Default API URL: `http://localhost:8111`
- **Path alias**: `@/` → `src/`
- **No component library** in use yet — shadcn configured (`components.json`) but no `components/ui/` exists

Provider hierarchy in root layout: `I18nProvider → AuthProvider → pages`

### API (api/app/)

- `main.py` — FastAPI app, CORS, router registration
- `models.py` — SQLAlchemy models: User, Document, Task
- `routers/` — auth, documents, tasks, history, quota
- `config.py` — Pydantic Settings from env vars
- `database.py` — async SQLAlchemy session

Key design: quota deduction uses atomic SQL (`UPDATE ... WHERE daily_quota_used < limit`) to prevent race conditions.

### Worker (worker/worker/)

- `celery_app.py` — Celery config, two queues: `default` and `office`
- `tasks.py` — Task execution with retry (max 3, backoff 5/15/30s), quota refund on final failure
- `converters/` — One module per conversion type:
  - `pdf_to_word.py` — PyMuPDF text extraction → python-docx
  - `word_to_pdf.py`, `excel_to_pdf.py`, `ppt_to_pdf.py` — LibreOffice headless
  - `pdf_to_image.py` — PyMuPDF page rendering
  - `image_to_pdf.py` — Pillow
  - `ocr_to_word.py` — PaddleOCR-VL 1.6 cloud → python-docx
- `services/paddle_ocr_service.py` — Cloud OCR API client

Office conversions (`word_to_pdf`, `excel_to_pdf`, `ppt_to_pdf`) route to the `office` queue for isolation.

### Database

PostgreSQL 16, managed by Alembic. Key tables:
- **users** — email/password, role (free/premium), daily quota tracking
- **documents** — file metadata, physical path, expiration
- **tasks** — conversion type, status (waiting→processing→success/failed), result path, retry count

### Shared Volumes (Docker)

- `upload_data` → `/tmp/uploads` (registered user files)
- `guest_data` → `/tmp/guest` (anonymous user files)

Note: Worker writes results to `/tmp/convert_*` which is NOT currently shared with the API container — this is a known deployment issue.

## Environment Variables

See `.env.example` for the full list. Critical ones:

| Variable | Used By | Purpose |
|----------|---------|---------|
| `JWT_SECRET` | API | Token signing |
| `DATABASE_URL` | API, Worker | PostgreSQL connection |
| `REDIS_URL` | API, Worker | Celery broker + result backend |
| `PADDLE_OCR_TOKEN` | Worker | PaddleOCR-VL cloud API auth |
| `NEXT_PUBLIC_API_URL` | Web | API base URL (build-time baked) |

## Known Issues / Gotchas

1. **README documents MiMo OCR** — actual implementation uses only PaddleOCR-VL 1.6 cloud service. No MiMo fallback exists.
2. **`NEXT_PUBLIC_API_URL` is build-time** — Docker runtime env won't override it; must be set during `next build`.
3. **Worker Dockerfile** may not include `-Q default,office` in its CMD — tasks won't be picked up without explicit queue subscription.
4. **Multi-page PDF→image** results are comma-joined paths; download endpoint only serves the first one.
