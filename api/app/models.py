import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    BigInteger,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    wechat_openid: Mapped[str | None] = mapped_column(
        String(128), unique=True, index=True
    )
    avatar: Mapped[str | None] = mapped_column(String(512))
    role: Mapped[str] = mapped_column(
        String(20), default="free", server_default="free"
    )
    daily_quota_used: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    quota_reset_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    documents: Mapped[list["Document"]] = relationship(back_populates="user")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True
    )
    filename: Mapped[str] = mapped_column(String(255))
    file_type: Mapped[str] = mapped_column(String(20))
    file_size: Mapped[int] = mapped_column(BigInteger)
    oss_path: Mapped[str | None] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(
        String(20), default="uploaded", server_default="uploaded"
    )
    file_status: Mapped[str] = mapped_column(
        String(20), default="active", server_default="active"
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User | None"] = relationship(back_populates="documents")
    tasks: Mapped[list["Task"]] = relationship(back_populates="document")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), index=True
    )
    task_type: Mapped[str] = mapped_column(String(30))
    ocr_mode: Mapped[str | None] = mapped_column(String(20))
    actual_engine: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(
        String(20), default="waiting", server_default="waiting"
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    result_path: Mapped[str | None] = mapped_column(String(512))
    error_message: Mapped[str | None] = mapped_column(Text)
    error_code: Mapped[str | None] = mapped_column(String(20))
    source_document_ids: Mapped[list | None] = mapped_column(JSONB)
    params: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    document: Mapped["Document"] = relationship(back_populates="tasks")
