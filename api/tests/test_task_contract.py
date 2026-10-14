"""Run only against a migrated, disposable PostgreSQL database.

TEST_DATABASE_URL must name a database ending in _test or _audit.
The suite truncates application tables; never point it at user data.
"""
import os
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

TEST_URL = os.environ.get("TEST_DATABASE_URL")
if TEST_URL:
    from sqlalchemy.engine import make_url
    if not (make_url(TEST_URL).database or "").endswith(("_test", "_audit")):
        raise RuntimeError("Use a disposable database ending in _test or _audit")
    os.environ["DATABASE_URL"] = TEST_URL
    os.environ.setdefault("JWT_SECRET", "isolated-regression-test-only")


@unittest.skipUnless(TEST_URL, "TEST_DATABASE_URL is required (disposable PostgreSQL)")
class TaskContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import SessionLocal
        cls.client = TestClient(app)
        cls.session_factory = staticmethod(SessionLocal)

    def setUp(self):
        from sqlalchemy import text
        from app.models import User
        from app.auth import create_access_token
        self.files = tempfile.TemporaryDirectory()
        self.addCleanup(self.files.cleanup)
        with self.session_factory() as db:
            db.execute(text("TRUNCATE tasks, documents, users CASCADE"))
            self.owner, self.other = uuid.uuid4(), uuid.uuid4()
            now = datetime.now(timezone.utc)
            for user_id in (self.owner, self.other):
                db.add(User(id=user_id, role="free", daily_quota_used=0, quota_reset_at=now))
            db.commit()
        self.headers = {"Authorization": "Bearer " + create_access_token({"sub": str(self.owner)})}
        self.other_headers = {"Authorization": "Bearer " + create_access_token({"sub": str(self.other)})}

    def document(self, owner=True, file_type="pdf"):
        from app.models import Document
        path = Path(self.files.name) / (str(uuid.uuid4()) + "." + file_type)
        path.write_bytes(b"isolated fixture")
        document_id = uuid.uuid4()
        with self.session_factory() as db:
            db.add(Document(id=document_id, user_id=self.owner if owner else None,
                            filename=path.name, file_type=file_type, file_size=path.stat().st_size,
                            oss_path=str(path), status="uploaded", file_status="active"))
            db.commit()
        return str(document_id)

    def create(self, document_id, task_type="pdf_to_word", headers=None):
        return self.client.post("/api/tasks/create", json={"document_id": document_id,
                                "task_type": task_type}, headers=headers or {})

    def used(self):
        from app.models import User
        with self.session_factory() as db:
            return db.get(User, self.owner).daily_quota_used

    def test_private_sources_and_tasks_fail_closed(self):
        document_id = self.document()
        for headers in ({}, self.other_headers):
            self.assertIn(self.create(document_id, headers=headers).status_code, (401, 403, 404))
        created = self.create(document_id, headers=self.headers)
        self.assertEqual(created.status_code, 201, created.text)
        task_id = created.json()["id"]
        for headers in ({}, self.other_headers, {"Authorization": "Bearer invalid"}):
            for suffix in ("status", "pages", "download", "download/0"):
                response = self.client.get(f"/api/tasks/{task_id}/{suffix}", headers=headers)
                self.assertIn(response.status_code, (401, 403, 404), (suffix, response.text))
            self.assertIn(self.client.post(f"/api/tasks/{task_id}/cancel", headers=headers).status_code,
                          (401, 403, 404))

    def test_legacy_guest_anchor_cannot_expose_private_secondary(self):
        from app.models import Task
        guest, private = self.document(owner=False), self.document()
        task_id = uuid.uuid4()
        with self.session_factory() as db:
            db.add(Task(id=task_id, document_id=uuid.UUID(guest), task_type="pdf_merge",
                        source_document_ids=[guest, private], user_id=None, status="success", result_paths=[]))
            db.commit()
        for headers in ({}, self.other_headers):
            response = self.client.get(f"/api/tasks/{task_id}/status", headers=headers)
            self.assertIn(response.status_code, (401, 403))
        self.assertEqual(self.client.get(f"/api/tasks/{task_id}/status", headers=self.headers).status_code, 200)

    def test_concurrent_creation_admits_and_charges_only_one_task(self):
        from concurrent.futures import ThreadPoolExecutor
        from threading import Barrier
        document_id = self.document()
        barrier = Barrier(2)
        def create_after_barrier(_):
            barrier.wait(timeout=5)
            return self.create(document_id, headers=self.headers).status_code
        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = list(executor.map(create_after_barrier, range(2)))
        self.assertEqual(sorted(statuses), [201, 429])
        self.assertEqual(self.used(), 1)

    def test_ocr_requires_login_before_task_or_quota_side_effects(self):
        from sqlalchemy import select, func
        from app.models import Task
        response = self.create(self.document(owner=False, file_type="png"), "ocr_to_word")
        self.assertIn(response.status_code, (401, 403))
        with self.session_factory() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Task)), 0)
        self.assertEqual(self.used(), 0)

    def test_creator_owns_task_even_with_guest_source_and_cancel_refunds_once(self):
        from app.models import Task, User
        response = self.create(self.document(owner=False), headers=self.headers)
        self.assertEqual(response.status_code, 201, response.text)
        task_id = response.json()["id"]
        self.assertEqual(self.used(), 1)
        with self.session_factory() as db:
            self.assertEqual(db.get(Task, uuid.UUID(task_id)).user_id, self.owner)
            db.get(User, self.owner).daily_quota_used = 3
            db.commit()
        self.assertEqual(self.client.post(f"/api/tasks/{task_id}/cancel", headers=self.headers).status_code, 200)
        self.assertEqual(self.used(), 2)
        self.client.post(f"/api/tasks/{task_id}/cancel", headers=self.headers)
        self.assertEqual(self.used(), 2)
        history = self.client.get("/api/documents/history", headers=self.headers)
        self.assertIn(task_id, [item["task_id"] for item in history.json()["items"]])

    def test_old_charge_cancellation_does_not_refund_current_day(self):
        from app.models import Task, User
        response = self.create(self.document(), headers=self.headers)
        task_id = response.json()["id"]
        with self.session_factory() as db:
            db.get(Task, uuid.UUID(task_id)).quota_date = datetime.now(timezone.utc).date() - timedelta(days=1)
            db.get(User, self.owner).daily_quota_used = 3
            db.commit()
        self.client.post(f"/api/tasks/{task_id}/cancel", headers=self.headers)
        self.assertEqual(self.used(), 3)

    def test_invalid_type_does_not_charge_and_active_task_blocks_both_entries(self):
        document_id = self.document()
        self.assertEqual(self.create(document_id, "unknown", self.headers).status_code, 422)
        self.assertEqual(self.used(), 0)
        self.assertEqual(self.create(document_id, headers=self.headers).status_code, 201)
        self.assertEqual(self.create(document_id, headers=self.headers).status_code, 429)
        images = [self.document(file_type="png"), self.document(file_type="png")]
        response = self.client.post("/api/tasks/create-merge", json={"document_ids": images}, headers=self.headers)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(self.used(), 1)

    def test_durable_dispatch_retries_broker_failure_and_uses_stable_id(self):
        from app import dispatcher
        from app.models import Task
        task_id = self.create(self.document(), headers=self.headers).json()["id"]
        with patch.object(dispatcher.celery_app, "send_task", side_effect=ConnectionError("offline")):
            dispatcher.dispatch_pending()
        with self.session_factory() as db:
            task = db.get(Task, uuid.UUID(task_id))
            self.assertEqual(task.status, "waiting")
            self.assertIsNone(task.dispatched_at)
        self.assertEqual(self.used(), 1)
        with patch.object(dispatcher.celery_app, "send_task") as publish:
            dispatcher.dispatch_pending()
            self.assertEqual(publish.call_args.kwargs["task_id"], task_id)
        with self.session_factory() as db:
            self.assertIsNotNone(db.get(Task, uuid.UUID(task_id)).dispatched_at)

    def test_active_multi_source_prevents_deletion(self):
        sources = [self.document(), self.document()]
        response = self.client.post("/api/tasks/create", headers=self.headers,
                                    json={"document_id": sources[0], "task_type": "pdf_merge",
                                          "source_document_ids": sources})
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(self.client.delete(f"/api/documents/{sources[1]}", headers=self.headers).status_code, 409)
        from app.models import Task
        with self.session_factory() as db:
            db.get(Task, uuid.UUID(response.json()["id"])).status = "success"
            db.commit()
        self.assertEqual(self.client.delete(f"/api/documents/{sources[1]}", headers=self.headers).status_code, 204)
        task_id = response.json()["id"]
        self.assertEqual(self.client.get(f"/api/tasks/{task_id}/status", headers=self.headers).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/documents/{sources[0]}", headers=self.headers).status_code, 204)

    def test_guest_anchor_deletion_still_checks_task_ownership(self):
        from app.models import Document, Task

        document_id = self.document(owner=False)
        created = self.create(document_id, headers=self.headers)
        self.assertEqual(created.status_code, 201, created.text)
        task_id = uuid.UUID(created.json()["id"])
        with self.session_factory() as db:
            db.get(Task, task_id).status = "success"
            db.commit()

        response = self.client.delete(
            f"/api/documents/{document_id}", headers=self.other_headers
        )
        self.assertEqual(response.status_code, 403, response.text)
        with self.session_factory() as db:
            self.assertIsNotNone(db.get(Task, task_id))
            self.assertIsNotNone(db.get(Document, uuid.UUID(document_id)))

    def test_unresolved_ocr_submission_evidence_blocks_anchor_deletion(self):
        from app.models import Document, Task, User

        document_id = uuid.UUID(self.document())
        with self.session_factory() as db:
            document = db.get(Document, document_id)
            source_path = Path(document.oss_path)
            db.get(User, self.owner).daily_quota_used = 1
            task = Task(
                document_id=document_id,
                user_id=self.owner,
                task_type="ocr_to_word",
                status="failed",
                quota_date=datetime.now(timezone.utc).date(),
                quota_refunded=False,
                ocr_job_state="uncertain",
                error_code="ERR_OCR_UNCERTAIN",
            )
            db.add(task)
            db.commit()
            task_id = task.id

        response = self.client.delete(f"/api/documents/{document_id}", headers=self.headers)
        self.assertEqual(response.status_code, 409, response.text)
        with self.session_factory() as db:
            self.assertIsNotNone(db.get(Task, task_id))
            self.assertIsNotNone(db.get(Document, document_id))
        self.assertEqual(self.used(), 1)
        self.assertTrue(source_path.exists())

    def test_reconciled_ocr_submission_does_not_block_anchor_deletion(self):
        from app.models import Document, Task

        document_id = uuid.UUID(self.document())
        with self.session_factory() as db:
            document = db.get(Document, document_id)
            source_path = Path(document.oss_path)
            task = Task(
                document_id=document_id,
                user_id=self.owner,
                task_type="ocr_to_word",
                status="failed",
                quota_date=datetime.now(timezone.utc).date(),
                quota_refunded=True,
                ocr_job_state="rejected",
                error_code="ERR_003",
            )
            db.add(task)
            db.commit()

        response = self.client.delete(f"/api/documents/{document_id}", headers=self.headers)
        self.assertEqual(response.status_code, 204, response.text)
        self.assertFalse(source_path.exists())





if __name__ == "__main__":
    unittest.main()
