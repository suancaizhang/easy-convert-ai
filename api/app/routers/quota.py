from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import date, datetime, timezone

from app.database import get_db
from app.deps import get_current_user
from app.models import User

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


@router.get("/status", response_model=QuotaStatusResponse)
def quota_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_quota_reset(db, current_user)
    total = get_user_quota_limit(current_user)
    used = current_user.daily_quota_used
    return QuotaStatusResponse(used=used, total=total, remaining=total - used)
