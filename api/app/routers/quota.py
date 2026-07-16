from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date, datetime, timezone

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.redis_client import redis_client

router = APIRouter(prefix="/api/quota", tags=["quota"])

QUOTA_LIMITS = {
    "guest": 3,
    "free": 8,
    "premium": 50,
}


class QuotaStatusResponse(BaseModel):
    used: int
    total: int
    remaining: int


def get_user_quota_limit(user: User) -> int:
    return QUOTA_LIMITS.get(user.role, 8)


def ensure_quota_reset(db: Session, user: User) -> None:
    today = datetime.now(timezone.utc).date()
    reset_date = user.quota_reset_at.date() if user.quota_reset_at else None
    if reset_date is None or reset_date < today:
        user.daily_quota_used = 0
        user.quota_reset_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)


def try_consume_quota(db: Session, user: User) -> bool:
    ensure_quota_reset(db, user)
    limit = get_user_quota_limit(user)
    result = db.execute(
        text(
            "UPDATE users SET daily_quota_used = daily_quota_used + 1 "
            "WHERE id = :uid AND daily_quota_used < :limit"
        ),
        {"uid": user.id, "limit": limit},
    )
    db.commit()
    return result.rowcount > 0


def refund_quota(db: Session, user: User) -> None:
    db.execute(
        text(
            "UPDATE users SET daily_quota_used = GREATEST(daily_quota_used - 1, 0) "
            "WHERE id = :uid"
        ),
        {"uid": user.id},
    )
    db.commit()


GUEST_DAILY_LIMIT = 3


def consume_quota(db: Session, user: User | None, request: Request) -> None:
    """Deduct one quota unit for user or guest. Raises HTTPException on limit exceeded."""
    if user:
        if not try_consume_quota(db, user):
            raise HTTPException(status_code=429, detail="今日配额已用完")
    else:
        client_ip = request.client.host if request.client else None
        if not client_ip:
            raise HTTPException(status_code=429, detail="无法识别客户端，请登录后使用")
        guest_key = f"guest_quota:{client_ip}"
        current = redis_client.get(guest_key)
        if current and int(current) >= GUEST_DAILY_LIMIT:
            raise HTTPException(
                status_code=429,
                detail=f"游客每日限额 {GUEST_DAILY_LIMIT} 次，请注册获取更多次数",
            )
        pipe = redis_client.pipeline()
        pipe.incr(guest_key)
        pipe.expire(guest_key, 86400)
        pipe.execute()


@router.get("/status", response_model=QuotaStatusResponse)
def quota_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_quota_reset(db, current_user)
    total = get_user_quota_limit(current_user)
    used = current_user.daily_quota_used
    return QuotaStatusResponse(used=used, total=total, remaining=total - used)
