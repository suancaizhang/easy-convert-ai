"""Migration regressions. TEST_DATABASE_URL must be disposable; all rows are removed."""
import json
import os
import unittest
import uuid
from pathlib import Path

TEST_URL = os.environ.get("TEST_DATABASE_URL")
if TEST_URL:
    from sqlalchemy.engine import make_url
    if not (make_url(TEST_URL).database or "").endswith(("_test", "_audit")):
        raise RuntimeError("Disposable database required")
    os.environ["DATABASE_URL"] = TEST_URL
    os.environ.setdefault("JWT_SECRET", "isolated-regression-test-only")


@unittest.skipUnless(TEST_URL, "TEST_DATABASE_URL is required")
class MigrationArtifactTests(unittest.TestCase):
    def setUp(self):
        from alembic import command
        from alembic.config import Config
        from sqlalchemy import create_engine, text
        self.engine = create_engine(TEST_URL)
        self.config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
        self.config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
        with self.engine.begin() as db:
            db.execute(text("TRUNCATE tasks, documents, users CASCADE"))
        command.downgrade(self.config, "003")

    def tearDown(self):
        from alembic import command
        command.upgrade(self.config, "head")
        self.engine.dispose()

    def legacy_rows(self):
        from sqlalchemy import text
        self.owner, self.other = uuid.uuid4(), uuid.uuid4()
        guest, private, other_document = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        self.owned_task, self.conflicted_task, self.missing_task = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        self.paths = ["/tmp/results/legacy/page-2.png", "/tmp/results/legacy/page-1.png"]
        with self.engine.begin() as db:
            for user_id in (self.owner, self.other):
                db.execute(text("INSERT INTO users (id, role, daily_quota_used) VALUES (:id, 'free', 0)"), {"id": user_id})
            for document_id, owner in ((guest, None), (private, self.owner), (other_document, self.other)):
                db.execute(text("INSERT INTO documents (id, user_id, filename, file_type, file_size, oss_path) "
                                "VALUES (:id, :owner, 'legacy.pdf', 'pdf', 1, '/tmp/legacy.pdf')"),
                           {"id": document_id, "owner": owner})
            for task_id, sources in ((self.owned_task, [guest, private]),
                                     (self.conflicted_task, [guest, private, other_document]),
                                     (self.missing_task, [guest, uuid.uuid4()])):
                db.execute(text("INSERT INTO tasks (id, document_id, task_type, status, result_path, source_document_ids) "
                                "VALUES (:id, :anchor, 'pdf_merge', 'success', :paths, CAST(:sources AS jsonb))"),
                           {"id": task_id, "anchor": guest, "paths": ",".join(self.paths),
                            "sources": json.dumps([str(item) for item in sources])})

    def test_guest_anchor_recovers_private_owner_and_conflicts_fail_closed(self):
        from alembic import command
        from sqlalchemy import text
        from fastapi.testclient import TestClient
        from app.main import app
        from app.auth import create_access_token
        self.legacy_rows()
        command.upgrade(self.config, "head")
        with self.engine.connect() as db:
            owned = db.execute(text("SELECT user_id, result_paths, quota_date FROM tasks WHERE id=:id"),
                               {"id": self.owned_task}).one()
            self.assertEqual(owned.user_id, self.owner)
            self.assertEqual(owned.result_paths, self.paths)
            self.assertIsNone(owned.quota_date)
            for task_id in (self.conflicted_task, self.missing_task):
                row = db.execute(text("SELECT status, error_code FROM tasks WHERE id=:id"), {"id": task_id}).one()
                self.assertEqual(tuple(row), ("failed", "ERR_ACCESS"))
        headers = {"Authorization": "Bearer " + create_access_token({"sub": str(self.owner)})}
        other_headers = {"Authorization": "Bearer " + create_access_token({"sub": str(self.other)})}
        with TestClient(app) as client:
            for denied in ({}, other_headers):
                for suffix in ("status", "pages", "download", "download/0"):
                    self.assertIn(client.get(f"/api/tasks/{self.owned_task}/{suffix}", headers=denied).status_code, (401, 403))
            self.assertEqual(client.get(f"/api/tasks/{self.owned_task}/status", headers=headers).status_code, 200)
            for identity in ({}, headers, other_headers):
                self.assertIn(client.get(f"/api/tasks/{self.conflicted_task}/status", headers=identity).status_code, (401, 403))

    def test_downgrade_refuses_long_artifacts_and_preserves_order_when_safe(self):
        from alembic import command
        from sqlalchemy import text
        self.legacy_rows()
        command.upgrade(self.config, "head")
        paths = [f"/tmp/results/{uuid.uuid4()}/{uuid.uuid4()}_page_{index}.png" for index in range(9)]
        with self.engine.begin() as db:
            db.execute(text("UPDATE tasks SET result_paths=CAST(:paths AS jsonb) WHERE id=:id"),
                       {"paths": json.dumps(paths), "id": self.owned_task})
        with self.assertRaisesRegex(Exception, "512"):
            command.downgrade(self.config, "003")
        with self.engine.begin() as db:
            self.assertEqual(db.scalar(text("SELECT version_num FROM alembic_version")), "004")
            self.assertEqual(db.scalar(text("SELECT result_paths FROM tasks WHERE id=:id"), {"id": self.owned_task}), paths)
            db.execute(text("UPDATE tasks SET result_paths=CAST(:paths AS jsonb) WHERE id=:id"),
                       {"paths": json.dumps(self.paths), "id": self.owned_task})
        command.downgrade(self.config, "003")
        with self.engine.connect() as db:
            self.assertEqual(db.scalar(text("SELECT result_path FROM tasks WHERE id=:id"),
                                       {"id": self.owned_task}), ",".join(self.paths))


if __name__ == "__main__":
    unittest.main()
