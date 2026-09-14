# ADR 0005: WeChat Mini Program entry (2026 contest) reusing the API

**Status**: Accepted
**Date**: 2026-09-14

## Context

The 2026 WeChat Mini Program AI Development Contest requires a WeChat Mini Program product launched between 2026-07-17 and 2026-10-17. The repository currently ships a web frontend (`web/`), a FastAPI backend (`api/`), and a Celery worker (`worker/`) providing 12 conversion types and PaddleOCR-VL OCR. There was no Mini Program frontend and no WeChat login path.

## Decision

- Add `miniprogram/` as a fourth independent install root: a Taro 3 (React 18 + TypeScript + webpack5) Mini Program. It renders WeChat-native pages and talks to the existing `api/` REST endpoints; no business logic is duplicated in the Mini Program.
- Mini Program users authenticate via `wx.login` → `POST /api/auth/wechat/login`; the API exchanges the code for an openid through WeChat `jscode2session` and issues the same JWT used by the web app. `users.wechat_openid` already existed since migration 001; no schema migration is required.
- The Mini Program covers the full task lifecycle for all 12 task types: quota display, file selection (album/camera or chat files by extension), upload, task creation, status polling, result preview (image paging, text render, `wx.openDocument`) and history management.
- Task quotas and the OCR login invariant stay enforced server-side; the Mini Program is only a client. `WECHAT_APPID` / `WECHAT_SECRET` are new API env settings; unconfigured WeChat login returns 503.
- Deployment targets WeChat Cloud (CloudBase hosting) which provides an official HTTPS domain for `request`/`downloadFile` whitelists, avoiding a separate ICP-filed domain; the web/API remain deployable via the existing compose stack.

## Alternatives Considered

- **Native WXML Mini Program** — no framework dependency, but duplicates state/type conventions and loses React/TS ergonomics; Taro matches the web codebase skill set.
- **uni-app (Vue)** — introduces a second component model inconsistent with the existing React frontend.
- **Mini Program only as a link to the web app** — violates the contest requirement of a WeChat Mini Program product and degrades the AI feature narrative.

## Consequences

- Reusing the API keeps the contract identical to the web client: polls `/api/tasks/{id}/status`, downloads `/api/tasks/{id}/download[/{i}]`, history via `/api/documents/history` and quota via `/api/quota/status`.
- Mini Program build output lives in `miniprogram/dist/` and is imported into WeChat DevTools with `project.config.json` (`appid` placeholder; replace before release). `TARO_APP_API_BASE` is baked at build time, like `NEXT_PUBLIC_API_URL` in `web/`.
- Long-running conversion polling is client-side; a task survives page exit and is visible in History.
- WeChat platform constraints apply: `chooseMedia` caps image multi-select at 9; download domains need HTTPS whitelisting in production; CloudBase is the path without ICP filing.

- Deploying the new API/Worker pair already follows the coordinated upgrade in `DEPLOYMENT.md`; the Mini Program adds no shared-state schema.
- `api/` gains `app/wechat.py` (jscode2session), one endpoint (`/api/auth/wechat/login`) and config settings; tests live in `api/tests/test_wechat_auth.py` and follow the existing disposable-PostgreSQL convention.
- `miniprogram/` is a new install root: `npm ci`-style install plus `npm run dev:weapp` / `npm run build:weapp`. It does not participate in the web build.
- The contest submission itself is the newly launched Mini Program; the web version is reused only as backend infrastructure.

See [DEPLOYMENT.md](../../DEPLOYMENT.md) for the Mini Program deployment section.