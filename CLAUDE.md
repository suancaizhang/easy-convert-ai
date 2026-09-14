# Project context

AI document conversion platform: PDF, Office files and images; paid OCR uses PaddleOCR-VL 1.6 only. `web/`, `api/`, `worker/` are independent install roots, not a package-manager monorepo.

For task lifecycle, authorization, quota or artifact changes, read `docs/adr/0004-task-ownership-delivery-and-artifacts.md`. For known defects and verification limits, read `docs/issues/04-project-audit-2026-09-12.md`. For deployment or migration, follow `DEPLOYMENT.md` rather than historical snippets.

## Commands

Frontend (`web/`, Node20-compatible):

```sh
npm ci --ignore-scripts
npm run dev
npm run test
npm run build
```

API (`api/`, Python3.11+, PostgreSQL16):

```sh
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8111
```

Start the durable task dispatcher in a separate process with the same API/database/broker environment:

```sh
python -m app.dispatcher
```

Worker (`worker/`):

```sh
pip install -r requirements.txt
celery -A worker.celery_app worker --loglevel=info --concurrency=2 -Q default,office
```

Mini program (`miniprogram/`, 2026 contest entry, Taro3+React, Node20-compatible):

```sh
npm install
npm run dev:weapp   # 构建后由微信开发者工具导入 miniprogram/dist
npm run build:weapp  # TARO_APP_API_BASE 在构建期注入后端地址
```

`users.wechat_openid` 自迁移 001 已存在；`POST /api/auth/wechat/login` 通过 jscode2session 用 `WECHAT_APPID`/`WECHAT_SECRET` 换取 openid，未配置时返回 503（见 ADR0005）。

Both queues are declared in `worker/config.py`; explicitly naming them is operational clarity, not a workaround for missing default subscriptions.

Docker: copy `.env.example` to `.env`, configure real secrets and the browser-facing API URL, then `docker compose up --build`. Six services: web, api, dispatcher, worker, redis, postgres. Only web/API are published to host loopback; DB/Redis remain inside the Compose network.

## Data flow and invariants

1. API uploads to `/tmp/uploads` or `/tmp/guest` and stores Document metadata.
2. API checks every source's ownership. Owned resources require the matching user; an absent/invalid token cannot bypass this. OCR requires login; guests may use non-OCR operations without a quota (ADR0003).
3. Task creation records its own user/charge identity. User quota and waiting task are committed together; the dispatcher delivers database-backed pending work to `default` or `office`.
4. Worker executes with per-task mutual exclusion and terminal-state guards. Retry is not final failure. Cancellation and actual charge refunds are transactional and at most once.
5. Worker writes outputs beneath `RESULT_DIR` (default `/tmp/results`) and records `result_paths` as an ordered JSONB list. API/Worker share that directory. No comma-joined output string or 512-character output list limit remains.
6. Frontend polls `/api/tasks/{id}/status` and fetches download/preview endpoints. Status responses do not expose physical filesystem paths.

Task statuses remain `waiting`, `processing`, `success`, `failed`; a cancelled waiting task is `failed` with `ERR_CANCELLED`. New Task.user_id is its creator, not necessarily the source document owner. Legacy ownership is inferred from all sources; conflicts or missing sources are quarantined as ERR_ACCESS and require manual reconciliation. `quota_date=NULL` means no recorded charge; old tasks are not assigned invented charge facts by migration. DB failures requeue delivery under a fresh execution lock; uncertain success commits preserve potentially published artifacts.

## Code map

### Frontend

Next.js15, React19, TypeScript, Tailwind. App Router pages include `/convert`, `/history`, `/login`, `/register`, `/tools/*`; `/merge-images` redirects to the images tool. `@/` maps to `src/`.

Providers: `I18nProvider → AuthProvider → pages`. Seven-language dictionaries live in `src/i18n`; JWT is currently held in localStorage by custom auth context. `useToolPage` owns upload/create/poll actions; preview components dispatch file rendering. Browser-only PDF.js must not be statically imported into server prerender paths.

### Mini program

`miniprogram/` is a fourth independent install root (Taro 3 + React 18 + TypeScript, weapp target only). Pages: `index` (tool picker + params + upload/create), `result` (poll `/api/tasks/{id}/status`, stops on `success`/`failed`, preview via image paging/text render/`wx.openDocument`), `history`, `login`. `src/api/client.ts` centralizes requests, auth headers and 401 handling (clear token + reLaunch login). `src/conversions.ts` is the declarative table for all 12 task types, their params and pickers. `TARO_APP_API_BASE` is baked at build time; `dist/` and `.swc/` are gitignored.

### API and Worker

API uses **synchronous** SQLAlchemy sessions (not async SQLAlchemy). Models: User, Document, Task. Routers: auth/documents/tasks/history/quota; `auth.py` also exposes `POST /api/auth/wechat/login` (code → openid via `app/wechat.py`, auto-registers a WeChat user with NULL email/password_hash, issues the same JWT). Unconfigured `WECHAT_APPID`/`WECHAT_SECRET` returns 503 (ADR0005). Alembic owns schema migrations; update the corresponding Worker models whenever shared fields change.

Worker's `CONVERTER_MAP` selects the 12 converters. Office conversions use LibreOffice subprocesses and route to `office`. `services/paddle_vl.py` implements cloud OCR; `ocr_to_word` remains the single OCR task type, with `params.output_format` selecting docx/txt/searchable_pdf (ADR0002). Ordered `source_document_ids` are authoritative multi-file inputs, with the first Document as anchor (ADR0001).

## Configuration and deployment gotchas

- `NEXT_PUBLIC_API_URL` is baked at build time. Compose passes it as a build argument; a runtime env change alone is ineffective. Use a URL reachable by the user's browser, not a container hostname. Same rule for the mini program's `TARO_APP_API_BASE`.
- The CloudBase image builds from the repo root (`deploy/cloudbase/Dockerfile`), so per-directory `.dockerignore` files do not apply there; the root `.dockerignore` excludes `.venv`/`node_modules`/`.env` from the build context. Never add secrets to the image via `COPY api/ /app/`.
- `DATABASE_URL`, `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` must agree between API/dispatcher/Worker. `REDIS_URL` configures API progress access. Local WSL uses localhost; Docker uses service names.
- `RESULT_DIR` must name the same physical shared storage for API and Worker. Compose mounts `result_data:/tmp/results` in both.
- Migration changes metadata, not files inside an old Worker container. Preserve old `/tmp/convert_*` output before replacing that container; see the coordinated upgrade procedure.
- Migration and new API/Worker must deploy together. Missing dispatcher leaves new tasks waiting; it is not fixed by resubmitting user requests.
- Ordinary multi-image download serves the first output; `/pages` and `/download/{page_index}` provide per-page access. There is no archive-download contract.
- There is no MiMo fallback, R2 adapter or automatic expiry cleanup. Do not advertise these from old documents.
- Run integration tests only against an isolated test database. Mocked sessions/SQLite cannot establish PostgreSQL lock, JSONB or migration correctness.
