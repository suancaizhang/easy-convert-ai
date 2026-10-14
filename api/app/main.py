from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine
from app.redis_client import redis_client
from app.routers import auth, documents, quota, tasks, history
from app.upload_limits import RequestSizeLimitMiddleware

app = FastAPI(title="Easy Convert AI", version="0.1.0")

app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(quota.router)
app.include_router(tasks.router)
app.include_router(history.router)


@app.get("/health")
def health_check():
    checks = {"status": "healthy", "database": False, "redis": False}

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        checks["status"] = "degraded"

    try:
        redis_client.ping()
        checks["redis"] = True
    except Exception:
        checks["status"] = "degraded"

    return checks
