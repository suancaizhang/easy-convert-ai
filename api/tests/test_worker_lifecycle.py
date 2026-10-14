"""Real PostgreSQL lifecycle tests; run with test_task_contract.py's disposable DB."""
import os
import tempfile
import unittest
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

TEST_URL = os.environ.get("TEST_DATABASE_URL")
if TEST_URL:
    from sqlalchemy.engine import make_url
    if not (make_url(TEST_URL).database or "").endswith(("_test", "_audit")):
        raise RuntimeError("Disposable database required")
    os.environ["DATABASE_URL"] = TEST_URL


@unittest.skipUnless(TEST_URL, "TEST_DATABASE_URL is required")
class WorkerLifecycleTests(unittest.TestCase):
    def setUp(self):
        from sqlalchemy import text
        from worker.database import SessionLocal
        from worker.models import User, Document, Task
        self.db_factory = SessionLocal
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.task_id, self.user_id = uuid.uuid4(), uuid.uuid4()
        source = Path(self.directory.name) / "source.pdf"
        import fitz
        with fitz.open() as pdf:
            for _ in range(9):
                pdf.new_page(width=30, height=30)
            pdf.save(source)
        with SessionLocal() as db:
            db.execute(text("TRUNCATE tasks, documents, users CASCADE"))
            now = datetime.now(timezone.utc)
            db.add(User(id=self.user_id, role="free", daily_quota_used=1, quota_reset_at=now))
            db.flush()
            document_id = uuid.uuid4()
            db.add(Document(id=document_id, user_id=self.user_id, filename="source.pdf", file_type="pdf",
                            file_size=source.stat().st_size, oss_path=str(source), status="uploaded", file_status="active"))
            db.flush()
            db.add(Task(id=self.task_id, document_id=document_id, user_id=self.user_id, task_type="pdf_to_image",
                        status="waiting", retry_count=0, quota_date=now.date(), quota_refunded=False,
                        dispatched_at=now, result_paths=[]))
            db.commit()
        self.env = patch.dict(os.environ, {"RESULT_DIR": self.directory.name})
        self.env.start()
        self.addCleanup(self.env.stop)

    def execution(self, retries=0):
        from celery.exceptions import Retry
        def retry(**kwargs):
            raise Retry(exc=kwargs.get("exc"), when=kwargs.get("countdown"))
        return SimpleNamespace(max_retries=3, request=SimpleNamespace(retries=retries), retry=retry)

    def snapshot(self):
        from worker.models import Task, User
        with self.db_factory() as db:
            task = db.get(Task, self.task_id)
            return task.status, list(task.result_paths), task.quota_refunded, db.get(User, self.user_id).daily_quota_used

    def configure_ocr(self):
        from worker.models import Task
        with self.db_factory() as db:
            task = db.get(Task, self.task_id)
            task.task_type = "ocr_to_word"
            task.params = {"output_format": "txt"}
            db.commit()
        env = patch.dict(os.environ, {"PADDLE_OCR_TOKEN": "isolated-test"})
        env.start()
        self.addCleanup(env.stop)

    def test_ocr_poll_retry_reuses_paid_job_and_preserves_charge(self):
        from celery.exceptions import Retry
        from worker import tasks
        from worker.services.paddle_vl import OcrPage, OcrResult, PaddleVLService
        self.configure_ocr()
        result = OcrResult([OcrPage(i, f"page {i}") for i in range(1, 10)], 9)
        with patch.object(PaddleVLService, "_submit_file", return_value="paid-job") as submit, \
             patch.object(PaddleVLService, "_poll_until_done", side_effect=[TimeoutError("poll interrupted"), "result-url"]), \
             patch.object(PaddleVLService, "_fetch_result", return_value=result):
            with self.assertRaises(Retry):
                tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(self.snapshot(), ("waiting", [], False, 1))
            tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(submit.call_count, 1)
        status, paths, refunded, used = self.snapshot()
        self.assertEqual((status, refunded, used), ("success", False, 1))
        self.assertIn("page 9", Path(paths[0]).read_text())

    def test_unknown_ocr_submit_is_terminal_without_refund_or_resubmit(self):
        from worker import tasks
        from worker.models import Task
        from worker.services.paddle_vl import PaddleVLService
        self.configure_ocr()
        with patch.object(PaddleVLService, "_submit_file", side_effect=TimeoutError("submit response lost")) as submit:
            tasks._run_conversion(self.execution(), str(self.task_id))
            tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(submit.call_count, 1)
        self.assertEqual(self.snapshot(), ("failed", [], False, 1))
        with self.db_factory() as db:
            task = db.get(Task, self.task_id)
            self.assertEqual(task.error_code, "ERR_OCR_UNCERTAIN")
            self.assertEqual(task.ocr_job_state, "uncertain")

    def test_explicit_ocr_rejection_fails_and_refunds_the_application_quota(self):
        from worker import tasks
        from worker.models import Task
        from worker.services.paddle_vl import OcrSubmissionRejected, PaddleVLService

        self.configure_ocr()
        with patch.object(
            PaddleVLService, "_submit_file", side_effect=OcrSubmissionRejected(401)
        ) as submit:
            tasks._run_conversion(self.execution(), str(self.task_id))

        self.assertEqual(submit.call_count, 1)
        self.assertEqual(self.snapshot(), ("failed", [], True, 0))
        with self.db_factory() as db:
            task = db.get(Task, self.task_id)
            self.assertEqual(task.error_code, "ERR_003")
            self.assertEqual(task.ocr_job_state, "rejected")

    def test_process_exit_after_submission_intent_never_resubmits(self):
        from worker import tasks
        from worker.models import Task
        from worker.services.paddle_vl import PaddleVLService
        self.configure_ocr()

        def submit_then_exit(path):
            with self.db_factory() as db:
                task = db.get(Task, self.task_id)
                self.assertEqual((task.ocr_job_state, task.ocr_job_id), ("submitting", None))
            raise SystemExit("simulated worker exit after provider accepted upload")

        with patch.object(PaddleVLService, "_submit_file", side_effect=submit_then_exit) as submit:
            with self.assertRaises(SystemExit):
                tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(self.snapshot(), ("processing", [], False, 1))
            tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(submit.call_count, 1)
        self.assertEqual(self.snapshot(), ("failed", [], False, 1))

    def test_job_id_commit_failure_fails_closed_after_lock_reacquisition(self):
        from celery.exceptions import Reject
        from sqlalchemy.exc import OperationalError
        from sqlalchemy.orm import Session
        from worker import tasks
        from worker.models import Task
        from worker.services.paddle_vl import PaddleVLService
        self.configure_ocr()
        original_commit = Session.commit

        def lose_job_id_commit(session):
            if any(isinstance(item, Task) and item.ocr_job_state == "submitted"
                   for item in session.identity_map.values()):
                raise OperationalError(None, None, ConnectionError("job ID commit unavailable"))
            original_commit(session)

        with patch.object(PaddleVLService, "_submit_file", return_value="paid-job") as submit, \
             patch.object(PaddleVLService, "_poll_until_done") as poll:
            with patch.object(Session, "commit", lose_job_id_commit), self.assertRaises(Reject):
                tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(self.snapshot(), ("processing", [], False, 1))
            tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(submit.call_count, 1)
            poll.assert_not_called()
        self.assertEqual(self.snapshot(), ("failed", [], False, 1))

    def test_committed_job_id_with_lost_response_resumes_without_resubmitting(self):
        from celery.exceptions import Reject
        from sqlalchemy.exc import OperationalError
        from sqlalchemy.orm import Session
        from worker import tasks
        from worker.models import Task
        from worker.services.paddle_vl import OcrPage, OcrResult, PaddleVLService
        self.configure_ocr()
        original_commit = Session.commit
        lost = False

        def lose_job_id_response(session):
            nonlocal lost
            saving_id = any(isinstance(item, Task) and item.ocr_job_state == "submitted"
                            for item in session.identity_map.values())
            original_commit(session)
            if saving_id and not lost:
                lost = True
                raise OperationalError(None, None, ConnectionError("commit response lost"))

        result = OcrResult([OcrPage(i, f"page {i}") for i in range(1, 10)], 9)
        with patch.object(PaddleVLService, "_submit_file", return_value="paid-job") as submit, \
             patch.object(PaddleVLService, "_poll_until_done", return_value="result-url"), \
             patch.object(PaddleVLService, "_fetch_result", return_value=result):
            with patch.object(Session, "commit", lose_job_id_response), self.assertRaises(Reject):
                tasks._run_conversion(self.execution(), str(self.task_id))
            tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(submit.call_count, 1)
        self.assertEqual(self.snapshot()[0], "success")

    def test_unknown_submission_with_lost_lock_never_reconnects_to_settle(self):
        from celery.exceptions import Reject
        from sqlalchemy import text
        from worker import tasks
        from worker.services.paddle_vl import PaddleVLService
        self.configure_ocr()
        original_begin = tasks._OcrJobStore.begin_submission
        pid = None

        def begin(store):
            nonlocal pid
            pid = store.db.scalar(text("SELECT pg_backend_pid()"))
            return original_begin(store)

        def lose_connection(path):
            with tasks.engine.begin() as killer:
                self.assertTrue(killer.scalar(text("SELECT pg_terminate_backend(:pid, 5000)"), {"pid": pid}))
            raise TimeoutError("submit response lost with database lock")

        with patch.object(tasks._OcrJobStore, "begin_submission", begin), \
             patch.object(PaddleVLService, "_submit_file", side_effect=lose_connection) as submit:
            with self.assertRaises(Reject):
                tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(self.snapshot(), ("processing", [], False, 1))
            tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(submit.call_count, 1)
        self.assertEqual(self.snapshot(), ("failed", [], False, 1))

    def test_ocr_image_failure_retries_existing_job_before_publishing_docx(self):
        import io
        import httpx
        from PIL import Image
        from docx import Document as WordDocument
        from celery.exceptions import Retry
        from worker import tasks
        from worker.models import Task
        from worker.services.paddle_vl import OcrPage, OcrResult, PaddleVLService
        self.configure_ocr()
        with self.db_factory() as db:
            db.get(Task, self.task_id).params = {"output_format": "docx"}
            db.commit()
        pages = [OcrPage(i, f"page {i}") for i in range(1, 10)]
        pages[0] = OcrPage(1, "![figure](figure.png)", {"figure.png": "https://example.invalid/figure"})
        image = io.BytesIO()
        Image.new("RGB", (8, 8), "red").save(image, "PNG")
        response = httpx.Response(200, content=image.getvalue(), request=httpx.Request("GET", "https://example.invalid/figure"))
        with patch.object(PaddleVLService, "_submit_file", return_value="paid-job") as submit, \
             patch.object(PaddleVLService, "_poll_until_done", return_value="result-url"), \
             patch.object(PaddleVLService, "_fetch_result", return_value=OcrResult(pages, 9)), \
             patch("worker.converters.ocr_to_word.httpx.get", side_effect=[httpx.ReadTimeout("image interrupted"), response]):
            with self.assertRaises(Retry):
                tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(self.snapshot(), ("waiting", [], False, 1))
            tasks._run_conversion(self.execution(), str(self.task_id))
            self.assertEqual(submit.call_count, 1)
        status, paths, refunded, used = self.snapshot()
        self.assertEqual((status, refunded, used), ("success", False, 1))
        self.assertEqual(len(WordDocument(paths[0]).inline_shapes), 1)

    def test_005_quarantines_attempted_legacy_ocr_and_blocks_lossy_downgrade(self):
        import importlib.util
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        from sqlalchemy import text
        from worker.database import engine
        migration_path = Path(__file__).parents[1] / "alembic/versions/005_ocr_job_recovery.py"
        spec = importlib.util.spec_from_file_location("ocr_recovery_migration", migration_path)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        with engine.begin() as connection:
            # A transaction-local table shadows the disposable database's tasks;
            # exercise the actual migration SQL without disturbing other fixtures.
            connection.execute(text("""
                CREATE TEMP TABLE tasks (
                    id integer, task_type varchar(30), status varchar(20),
                    retry_count integer, error_code varchar(20), error_message text,
                    quota_date date, quota_refunded boolean
                ) ON COMMIT DROP
            """))
            connection.execute(text("""
                INSERT INTO tasks (id, task_type, status, retry_count, quota_date, quota_refunded)
                VALUES (1, 'ocr_to_word', 'processing', 0, CURRENT_DATE, false),
                       (2, 'ocr_to_word', 'waiting', 1, CURRENT_DATE, false),
                       (3, 'ocr_to_word', 'waiting', 0, CURRENT_DATE, false),
                       (4, 'pdf_merge', 'processing', 1, NULL, false),
                       (5, 'ocr_to_word', 'success', 0, CURRENT_DATE, false)
            """))
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
                rows = connection.execute(text("""
                    SELECT id, status, ocr_job_state, error_code, quota_refunded,
                           quota_date IS NOT NULL AS charged, ocr_job_id
                    FROM tasks ORDER BY id
                """)).all()
                self.assertEqual(rows, [
                    (1, "failed", "uncertain", "ERR_OCR_UNCERTAIN", False, True, None),
                    (2, "failed", "uncertain", "ERR_OCR_UNCERTAIN", False, True, None),
                    (3, "waiting", None, None, False, True, None),
                    (4, "processing", None, None, False, False, None),
                    (5, "success", None, None, False, True, None),
                ])
                with self.assertRaises(RuntimeError):
                    migration.downgrade()
                connection.execute(text("DELETE FROM tasks WHERE ocr_job_state IS NOT NULL"))
                connection.execute(text("UPDATE tasks SET ocr_job_id = 'provider-evidence' WHERE id = 3"))
                with self.assertRaises(RuntimeError):
                    migration.downgrade()
                connection.execute(text("UPDATE tasks SET ocr_job_id = NULL WHERE id = 3"))
                migration.downgrade()
                self.assertEqual(connection.scalar(text("SELECT status FROM tasks WHERE id = 4")), "processing")

    def test_nine_page_artifacts_persist_and_success_is_not_reexecuted(self):
        from worker import tasks
        with patch.object(tasks, "report_progress"):
            tasks._run_conversion(self.execution(), str(self.task_id))
        first = self.snapshot()
        self.assertEqual(first[0], "success")
        self.assertEqual(len(first[1]), 9)
        self.assertTrue(all(Path(path).is_file() for path in first[1]))
        tasks._run_conversion(self.execution(), str(self.task_id))
        self.assertEqual(self.snapshot(), first)

    def test_cancelled_task_never_executes(self):
        from worker import tasks
        from worker.models import Task
        with self.db_factory() as db:
            task = db.get(Task, self.task_id)
            task.status, task.error_code = "failed", "ERR_CANCELLED"
            db.commit()
        tasks._run_conversion(self.execution(), str(self.task_id))
        self.assertEqual(self.snapshot()[0:2], ("failed", []))

    def test_retry_propagates_without_refund_then_final_failure_refunds_once(self):
        from celery.exceptions import Retry
        from worker import tasks
        class TransientConverter:
            def convert(self, *args, **kwargs):
                raise RuntimeError("temporary conversion failure")
        with patch.dict(tasks.CONVERTER_MAP, {"pdf_to_image": TransientConverter}):
            for retries in range(3):
                with self.assertRaises(Retry):
                    tasks._run_conversion(self.execution(retries), str(self.task_id))
                self.assertEqual(self.snapshot(), ("waiting", [], False, 1))
            tasks._run_conversion(self.execution(3), str(self.task_id))
            self.assertEqual(self.snapshot(), ("failed", [], True, 0))
            tasks._run_conversion(self.execution(3), str(self.task_id))
            self.assertEqual(self.snapshot(), ("failed", [], True, 0))

    def test_unbilled_failure_does_not_reduce_another_tasks_usage(self):
        from worker import tasks
        from worker.models import Task
        with self.db_factory() as db:
            task = db.get(Task, self.task_id)
            task.task_type, task.params, task.quota_date = "pdf_split", {"pages": "999"}, None
            db.commit()
        tasks._run_conversion(self.execution(), str(self.task_id))
        self.assertEqual(self.snapshot(), ("failed", [], False, 1))

    def test_database_outage_requeues_instead_of_acknowledging_failure(self):
        from celery.exceptions import Reject
        from sqlalchemy.exc import OperationalError
        from worker import tasks
        task_id = self.task_id
        failure = OperationalError(None, None, ConnectionError("isolated database outage"))
        with patch.object(tasks.engine, "connect", side_effect=failure):
            with self.assertRaises(Reject) as raised:
                tasks._run_conversion(self.execution(), str(task_id))
        self.assertTrue(raised.exception.requeue)
        self.assertEqual(self.snapshot(), ("waiting", [], False, 1))

    def test_committed_success_with_lost_response_preserves_artifacts(self):
        from celery.exceptions import Reject
        from sqlalchemy.exc import OperationalError
        from sqlalchemy.orm import Session
        from worker import tasks
        from worker.models import Task
        task_id = self.task_id
        original_commit = Session.commit
        lost = False

        def commit_with_lost_response(session):
            nonlocal lost
            publishing = any(isinstance(item, Task) and item.status == "success"
                             for item in session.identity_map.values())
            original_commit(session)
            if publishing and not lost:
                lost = True
                raise OperationalError(None, None, ConnectionError("commit response lost"),
                                       connection_invalidated=True)

        with patch.object(Session, "commit", commit_with_lost_response):
            with self.assertRaises(Reject) as raised:
                tasks._run_conversion(self.execution(), str(task_id))
        self.assertTrue(raised.exception.requeue)
        with self.db_factory() as db:
            paths = list(db.get(Task, task_id).result_paths)
        self.assertEqual(self.snapshot(), ("success", paths, False, 1))
        self.assertEqual(len(paths), 9)
        self.assertTrue(all(Path(path).is_file() for path in paths))
        tasks._run_conversion(self.execution(), str(task_id))
        with self.db_factory() as db:
            self.assertEqual(db.get(Task, task_id).result_paths, paths)

    def test_lost_database_lock_cannot_overwrite_a_completed_redelivery(self):
        from celery.exceptions import Reject
        from sqlalchemy import text
        from worker import tasks
        original_input = tasks._input_path
        terminated = False
        completed = None

        def terminate_and_redeliver(db, task):
            nonlocal terminated, completed
            path = original_input(db, task)
            if not terminated:
                terminated = True
                pid = db.scalar(text("SELECT pg_backend_pid()"))
                with tasks.engine.begin() as killer:
                    # Wait for exit, not merely successful delivery of the termination signal.
                    self.assertTrue(killer.scalar(text("SELECT pg_terminate_backend(:pid, 5000)"), {"pid": pid}))
                tasks._run_conversion(self.execution(), str(self.task_id))
                completed = self.snapshot()
            return path

        with patch.object(tasks, "_input_path", terminate_and_redeliver), patch.object(tasks, "report_progress"):
            with self.assertRaises(Reject) as raised:
                tasks._run_conversion(self.execution(), str(self.task_id))
        self.assertTrue(raised.exception.requeue)
        self.assertEqual(self.snapshot(), completed)
        self.assertEqual(completed[0], "success")
        self.assertEqual(completed[2:], (False, 1))
        self.assertTrue(all(Path(path).is_file() for path in completed[1]))

    def test_actual_celery_retry_publish_failure_restores_durable_intent(self):
        from celery.exceptions import Reject
        from worker import tasks
        from worker.models import Task
        class TransientConverter:
            def convert(self, *args, **kwargs):
                raise RuntimeError("temporary converter outage")
        execution = tasks.convert_document
        execution.push_request(id=str(self.task_id), args=(str(self.task_id),), kwargs={},
                               retries=0, called_directly=False, is_eager=False,
                               delivery_info={"routing_key": "default"})
        try:
            with patch.dict(tasks.CONVERTER_MAP, {"pdf_to_image": TransientConverter}), \
                 patch.object(execution, "apply_async", side_effect=ConnectionError("broker unavailable")):
                with self.assertRaises(Reject):
                    tasks._run_conversion(execution, str(self.task_id))
        finally:
            execution.pop_request()
        self.assertEqual(self.snapshot(), ("waiting", [], False, 1))
        with self.db_factory() as db:
            self.assertIsNone(db.get(Task, self.task_id).dispatched_at)

    def test_duplicate_delivery_cannot_claim_while_execution_lock_is_held(self):
        from sqlalchemy import text
        from worker import tasks
        from worker.database import engine
        key = self.task_id.int % (1 << 63)
        with engine.connect() as connection:
            connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": key})
            connection.commit()
            try:
                tasks._run_conversion(self.execution(), str(self.task_id))
                self.assertEqual(self.snapshot(), ("waiting", [], False, 1))
            finally:
                connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": key})
                connection.commit()


if __name__ == "__main__":
    unittest.main()
