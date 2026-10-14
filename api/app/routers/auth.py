from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import hash_password, verify_password, create_access_token, validate_password_size
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.wechat import code2openid

router = APIRouter(prefix="/api/auth", tags=["auth"])

def password_within_bcrypt_limit(value: str) -> str:
    try:
        return validate_password_size(value)
    except ValueError as exc:
        # Default validation errors include the input; never echo a password.
        raise HTTPException(status_code=422, detail=str(exc)) from exc


Password = Annotated[str, AfterValidator(password_within_bcrypt_limit)]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: Password


class LoginRequest(BaseModel):
    email: EmailStr
    password: Password


class WechatLoginRequest(BaseModel):
    code: str = Field(min_length=1, max_length=128)
    avatar: str | None = Field(default=None, max_length=512)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str | None
    avatar: str | None
    role: str

    class Config:
        from_attributes = True


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="密码长度不能少于6位")
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="该邮箱已注册")
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.post("/wechat/login", response_model=TokenResponse)
def wechat_login(body: WechatLoginRequest, db: Session = Depends(get_db)):
    """小程序端：wx.login 拿 code，服务端换取 openid 并登录/注册。"""
    openid = code2openid(body.code)
    user = db.query(User).filter(User.wechat_openid == openid).first()
    if user is None:
        user = User(wechat_openid=openid, avatar=body.avatar)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            user = db.query(User).filter(User.wechat_openid == openid).first()
            if user is None:
                raise
        else:
            db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        avatar=current_user.avatar,
        role=current_user.role,
    )
