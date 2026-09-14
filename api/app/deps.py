from uuid import UUID

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.database import get_db
from app.models import User

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=401, detail="未登录")
    payload = decode_access_token(credentials.credentials)
    try:
        user_id = UUID(payload["sub"]) if payload else None
    except (KeyError, ValueError, TypeError, AttributeError):
        user_id = None
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None and not request.headers.get("authorization"):
        return None
    return get_current_user(credentials, db)


def require_owner(owner_id: UUID | None, user: User | None) -> None:
    """Ownerless guest resources retain their existing UUID-capability policy."""
    if owner_id is not None:
        if user is None:
            raise HTTPException(status_code=401, detail="此资源需要登录")
        if owner_id != user.id:
            raise HTTPException(status_code=403, detail="无权访问此资源")
