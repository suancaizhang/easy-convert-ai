"""Security regressions; database cases require a migrated disposable PostgreSQL."""
import asyncio
import os
import tempfile
import unittest
import uuid
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "isolated-regression-test-only")
TEST_URL = os.environ.get("TEST_DATABASE_URL")
if TEST_URL:
    from sqlalchemy.engine import make_url
    if not (make_url(TEST_URL).database or "").endswith(("_test", "_audit")):
        raise RuntimeError("Use a disposable database ending in _test or _audit")
    os.environ["DATABASE_URL"] = TEST_URL


class UploadIngressTests(unittest.TestCase):
    def test_chunked_multipart_stops_receiving_and_closes_spool_on_limit(self):
        from app.main import app
        from starlette.formparsers import SpooledTemporaryFile
        opened = []
        sent = []
        reads = 0
        boundary = b'--safe\r\nContent-Disposition: form-data; name="file"; filename="a.pdf"\r\nContent-Type: application/pdf\r\n\r\n'
        chunks = iter([boundary] + [b"x" * (1024 * 1024)] * 32 + [b"\r\n--safe--\r\n"])

        def spool(*args, **kwargs):
            handle = SpooledTemporaryFile(*args, **kwargs)
            opened.append(handle)
            return handle

        async def receive():
            nonlocal reads
            reads += 1
            return {"type": "http.request", "body": next(chunks), "more_body": True}

        async def send(message):
            sent.append(message)

        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "POST", "scheme": "http", "path": "/api/documents/upload", "raw_path": b"/api/documents/upload", "query_string": b"", "root_path": "", "headers": [(b"content-type", b"multipart/form-data; boundary=safe")], "client": ("127.0.0.1", 1), "server": ("test", 80)}
        with patch("starlette.formparsers.SpooledTemporaryFile", side_effect=spool):
            asyncio.run(app(scope, receive, send))
        self.assertEqual(sent[0]["status"], 413)
        self.assertLessEqual(reads, 23)
        self.assertTrue(opened)
        self.assertTrue(all(handle.closed for handle in opened))

    def test_oversized_non_file_part_is_rejected_and_spool_closed(self):
        from fastapi.testclient import TestClient
        from app.main import app
        from starlette.formparsers import SpooledTemporaryFile
        opened = []

        def spool(*args, **kwargs):
            handle = SpooledTemporaryFile(*args, **kwargs)
            opened.append(handle)
            return handle

        with TestClient(app) as client, patch("starlette.formparsers.SpooledTemporaryFile", side_effect=spool):
            response = client.post("/api/documents/upload", files=[
                ("file", ("a.pdf", b"%PDF fixture", "application/pdf")),
                ("note", (None, b"x" * (1024 * 1024 + 1))),
            ])
        self.assertEqual(response.status_code, 400)
        self.assertTrue(opened)
        self.assertTrue(all(handle.closed for handle in opened))

    def test_declared_oversize_does_not_read_request(self):
        from fastapi.testclient import TestClient
        from app.main import app
        with TestClient(app) as client:
            response = client.post("/api/documents/upload", content=b"not multipart", headers={"Content-Length": str(32 * 1024 * 1024), "Content-Type": "multipart/form-data; boundary=safe"})
        self.assertEqual(response.status_code, 413)


@unittest.skipUnless(TEST_URL, "TEST_DATABASE_URL is required (disposable PostgreSQL)")
class SecurityContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import SessionLocal
        cls.client = TestClient(app, raise_server_exceptions=False)
        cls.session_factory = staticmethod(SessionLocal)

    def setUp(self):
        from sqlalchemy import text
        with self.session_factory() as db:
            db.execute(text("TRUNCATE tasks, documents, users CASCADE"))
            db.commit()
        self.files = tempfile.TemporaryDirectory()
        self.addCleanup(self.files.cleanup)
        patcher = patch("app.routers.documents.GUEST_UPLOAD_DIR", self.files.name)
        patcher.start()
        self.addCleanup(patcher.stop)

    def upload(self, filename="a.pdf", content=b"%PDF-1.4 fixture"):
        return self.client.post("/api/documents/upload", files={"file": (filename, content, "application/pdf")})

    def test_utf8_password_limit_and_existing_bcrypt_login(self):
        from app.models import User
        from app.auth import hash_password
        password = "界" * 24  # 72 bytes, not 72 characters
        with self.session_factory() as db:
            stored = hash_password(password)
            db.add(User(email="legacy@example.com", password_hash=stored))
            db.commit()
        response = self.client.post("/api/auth/login", json={"email": "legacy@example.com", "password": password})
        self.assertEqual(response.status_code, 200)
        me = self.client.get("/api/auth/me", headers={"Authorization": "Bearer " + response.json()["access_token"]})
        self.assertEqual(me.json()["email"], "legacy@example.com")
        for path in ("login", "register"):
            response = self.client.post(f"/api/auth/{path}", json={"email": "legacy@example.com" if path == "login" else "new@example.com", "password": password + "x"})
            self.assertEqual(response.status_code, 422)
            self.assertNotIn(password, response.text)
        with self.session_factory() as db:
            self.assertEqual(db.query(User).filter(User.email == "legacy@example.com").one().password_hash, stored)
            self.assertEqual(db.query(User).count(), 1)

    def test_registration_accepts_exactly_72_bytes_and_rejects_wrong_password(self):
        body = {"email": "new@example.com", "password": "a" * 72}
        self.assertEqual(self.client.post("/api/auth/register", json=body).status_code, 201)
        self.assertEqual(self.client.post("/api/auth/login", json=body).status_code, 200)
        body["password"] = "b" + "a" * 71
        self.assertEqual(self.client.post("/api/auth/login", json=body).status_code, 401)

    def test_existing_hs256_tokens_remain_valid_but_invalid_tokens_are_denied(self):
        import base64
        import hashlib
        import hmac
        import json
        import time
        from app.config import settings
        from app.models import User

        with self.session_factory() as db:
            user = User()
            db.add(user)
            db.commit()
            user_id = str(user.id)

        def encoded(value):
            return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=")

        # Construct the pre-existing JWT wire format independently of PyJWT.
        for expiry, algorithm, valid in ((int(time.time()) + 60, "HS256", True), (0, "HS256", False), (int(time.time()) + 60, "HS384", False)):
            content = encoded({"alg": algorithm, "typ": "JWT"}) + b"." + encoded({"sub": user_id, "exp": expiry})
            signature = hmac.new(settings.jwt_secret.encode(), content, hashlib.sha256).digest()
            token = (content + b"." + base64.urlsafe_b64encode(signature).rstrip(b"=")).decode()
            response = self.client.get("/api/auth/me", headers={"Authorization": "Bearer " + token})
            self.assertEqual(response.status_code, 200 if valid else 401)
            if valid:
                self.assertEqual(response.json()["id"], user_id)

    def test_filename_boundary_precedes_persistence(self):
        from app.models import Document
        too_long = self.upload("a" * 252 + ".pdf")
        self.assertEqual(too_long.status_code, 400)
        self.assertEqual(list(Path(self.files.name).iterdir()), [])
        with self.session_factory() as db:
            self.assertEqual(db.query(Document).count(), 0)
        name = "界" * 251 + ".pdf"
        accepted = self.upload(name)
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.json()["filename"], name)

    def test_exact_file_size_and_one_byte_over(self):
        from app.models import Document
        size = 20 * 1024 * 1024
        self.assertEqual(self.upload(content=b"x" * (size + 1)).status_code, 413)
        self.assertEqual(list(Path(self.files.name).iterdir()), [])
        accepted = self.upload(content=b"x" * size)
        self.assertEqual(accepted.status_code, 200)
        self.assertEqual(accepted.json()["file_size"], size)
        with self.session_factory() as db:
            doc = db.get(Document, uuid.UUID(accepted.json()["id"]))
            self.assertEqual(Path(doc.oss_path).stat().st_size, size)

    def test_failed_insert_removes_unpublished_file(self):
        from sqlalchemy.exc import IntegrityError
        with patch("sqlalchemy.orm.Session.flush", side_effect=IntegrityError("insert", {}, Exception("rejected"))):
            response = self.upload()
        self.assertEqual(response.status_code, 500)
        self.assertEqual(list(Path(self.files.name).iterdir()), [])

    def test_unknown_commit_outcome_preserves_committed_file(self):
        from app.models import Document
        from sqlalchemy.orm import Session
        original = Session.commit

        def lost_ack(session):
            original(session)
            raise ConnectionError("commit acknowledgement lost")

        with patch.object(Session, "commit", lost_ack):
            response = self.upload()
        self.assertEqual(response.status_code, 500)
        with self.session_factory() as db:
            doc = db.query(Document).one()
            self.assertEqual(Path(doc.oss_path).read_bytes(), b"%PDF-1.4 fixture")

    def test_ocr_unknown_submission_cannot_be_cancelled_and_refunded(self):
        from app.models import User, Document, Task
        from app.auth import create_access_token
        cases = [("submitting", None, False), ("uncertain", None, False),
                 (None, "retained", False), ("submitted", None, False),
                 ("submitted", "retained", True)]
        for state, job_id, cancellable in cases:
            with self.subTest(state=state, job_id=job_id), self.session_factory() as db:
                user = User(daily_quota_used=1, quota_reset_at=datetime.now(timezone.utc))
                doc = Document(filename="a.pdf", file_type="pdf", file_size=1, oss_path="/not-used")
                db.add_all([user, doc])
                db.flush()
                task = Task(document_id=doc.id, user_id=user.id, task_type="ocr_to_word", status="waiting", quota_date=datetime.now(timezone.utc).date(), quota_refunded=False, ocr_job_state=state, ocr_job_id=job_id)
                db.add(task)
                db.commit()
                task_id, user_id = task.id, user.id
                headers = {"Authorization": "Bearer " + create_access_token({"sub": str(user_id)})}
            response = self.client.post(f"/api/tasks/{task_id}/cancel", headers=headers)
            self.assertEqual(response.status_code, 200 if cancellable else 409)
            with self.session_factory() as db:
                task = db.get(Task, task_id)
                self.assertEqual(task.ocr_job_state, state)
                self.assertEqual(task.quota_refunded, cancellable)
                self.assertEqual(db.get(User, user_id).daily_quota_used, 0 if cancellable else 1)
                self.assertEqual(task.ocr_job_id, job_id)


if __name__ == "__main__":
    unittest.main()
