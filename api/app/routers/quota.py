from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Task, User

router = APIRouter(prefix="/api/quota", tags=["quota"])
QUOTA_LIMITS = {"free": 8, "premium": 50}


class QuotaStatusResponse(BaseModel):
    used: int
    total: int
    remaining: int


def get_user_quota_limit(user: User) -> int:
    return QUOTA_LIMITS.get(user.role, 8)


def lock_quota_user(db: Session, user_id) -> User:
    # Refresh the authentication dependency's possibly stale identity-map entry.
    return db.query(User).filter(User.id == user_id).populate_existing().with_for_update().one()


def reset_quota_window(user: User):
    now = datetime.now(timezone.utc)
    if user.quota_reset_at is None or user.quota_reset_at.astimezone(timezone.utc).date() < now.date():
        user.daily_quota_used = 0
        user.quota_reset_at = now
    return now.date()


def charge_quota(user: User):
    """Caller holds the user row lock and commits this with the new task."""
    quota_date = reset_quota_window(user)
    if user.daily_quota_used >= get_user_quota_limit(user):
        raise HTTPException(status_code=429, detail="今日配额已用完")
    user.daily_quota_used += 1
    return quota_date


def refund_task_quota(db: Session, task: Task) -> None:
    """Caller holds the task row lock; commit settlement with its terminal state."""
    if task.quota_date is None or task.quota_refunded:
        return
    if task.user_id is not None:
        db.execute(text(
            "UPDATE users SET daily_quota_used = GREATEST(daily_quota_used - 1, 0) "
            "WHERE id = :uid AND (quota_reset_at AT TIME ZONE 'UTC')::date = :quota_date"
        ), {"uid": task.user_id, "quota_date": task.quota_date})
    task.quota_refunded = True


@router.get("/status", response_model=QuotaStatusResponse)
def quota_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = lock_quota_user(db, current_user.id)
    reset_quota_window(user)
    total = get_user_quota_limit(user)
    used = user.daily_quota_used
    db.commit()
    return QuotaStatusResponse(used=used, total=total, remaining=max(total - used, 0))
