#!/bin/sh
set -e

MODE="${SERVICE_MODE:-api}"
PORT="${PORT:-8000}"

case "$MODE" in
  api)
    echo "[cloudbase] running DB migrations..."
    alembic upgrade head
    echo "[cloudbase] starting API on :$PORT"
    exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
    ;;
  processor)
    cleanup() {
      trap - EXIT TERM INT
      kill "$health_pid" "$dispatcher_pid" "$worker_pid" 2>/dev/null || true
      wait "$health_pid" "$dispatcher_pid" "$worker_pid" 2>/dev/null || true
    }
    shutdown() {
      cleanup
      exit 0
    }

    echo "[cloudbase] starting health probe on :$PORT"
    python health_server.py --port "$PORT" &
    health_pid=$!
    echo "[cloudbase] starting durable dispatcher..."
    python -m app.dispatcher &
    dispatcher_pid=$!
    echo "[cloudbase] starting celery worker (default,office)..."
    celery -A worker.celery_app worker --loglevel=info --concurrency=2 -Q default,office &
    worker_pid=$!

    trap cleanup EXIT
    trap shutdown TERM INT
    while kill -0 "$health_pid" 2>/dev/null \
      && kill -0 "$dispatcher_pid" 2>/dev/null \
      && kill -0 "$worker_pid" 2>/dev/null; do
      sleep 1
    done
    echo "[cloudbase] critical processor process exited; stopping container" >&2
    exit 1
    ;;
  *)
    echo "[cloudbase] unknown SERVICE_MODE=$MODE (api|processor)" >&2
    exit 1
    ;;
esac