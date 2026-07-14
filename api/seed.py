"""Seed data for local development."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from app.database import SessionLocal
from app.models import User, Document


def seed():
    db = SessionLocal()
    try:
        existing = db.execute(text("SELECT count(*) FROM users")).scalar()
        if existing > 0:
            print("Seed data already exists, skipping.")
            return

        test_user = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            email="test@example.com",
            password_hash="$2b$12$placeholder_hash_for_seed_data",
            role="free",
            daily_quota_used=0,
            quota_reset_at=datetime.now(timezone.utc),
        )
        db.add(test_user)

        demo_doc = Document(
            id=uuid.UUID("00000000-0000-0000-0000-000000000010"),
            user_id=test_user.id,
            filename="sample.pdf",
            file_type="pdf",
            file_size=102400,
            status="uploaded",
            file_status="active",
        )
        db.add(demo_doc)

        db.commit()
        print("Seed data inserted successfully.")
    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
