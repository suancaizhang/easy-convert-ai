"""PaddleOCR-VL-1.6 云服务封装

异步 API 流程：提交 job → 轮询状态 → 获取 JSONL 结果
"""

import json
import logging
import os
import time
from typing import Protocol
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
MODEL = "PaddleOCR-VL-1.6"

# 轮询配置
POLL_INTERVAL = 3  # 秒
POLL_TIMEOUT = 300  # 最大等待秒数


@dataclass
class OcrPage:
    """单页 OCR 结果"""

    page_num: int
    markdown_text: str
    images: dict[str, str] = field(default_factory=dict)  # {相对路径: 下载URL}


@dataclass
class OcrResult:
    """完整 OCR 结果"""

    pages: list[OcrPage] = field(default_factory=list)
    total_pages: int = 0



class OcrSubmissionRejected(ValueError):
    """The provider explicitly rejected a submission without creating a job."""

    def __init__(self, status_code: int):
        self.status_code = status_code
        super().__init__(f"OCR provider rejected submission (HTTP {status_code})")


REJECTED_SUBMISSION_STATUS_CODES = {400, 401, 403, 413, 415, 422}

class OcrSubmissionUncertain(RuntimeError):
    """A paid submission may exist; automatic resubmission/refund is unsafe."""


class OcrJobStore(Protocol):
    def begin_submission(self) -> str | None:
        """Return an existing job ID, or durably claim a never-submitted job."""
        ...

    def record_job(self, job_id: str) -> None:
        """Durably record the provider ID before any polling or download."""
        ...


class PaddleVLService:
    """PaddleOCR-VL-1.6 云服务客户端

    封装提交 → 轮询 → 获取结果的完整流程为同步调用。
    """

    def __init__(self, token: str, options: dict | None = None):
        if not token:
            raise ValueError("PADDLE_OCR_TOKEN not configured")
        self.token = token
        self.options = options or {
            "useDocOrientationClassify": False,
            "useDocUnwarping": False,
            "useChartRecognition": False,
        }
        self._headers = {"Authorization": f"bearer {self.token}"}

    def ocr_file(self, file_path: str, *, job_store: OcrJobStore) -> OcrResult:
        """Resume a durable job, or record intent before the single paid POST.

        There is no provider idempotency guarantee. An unknown submission stays
        blocked until an operator reconciles the provider's billing/job records.
        Database errors must escape unchanged so the worker reacquires its lock.
        """
        if job_store is None:
            raise ValueError("Durable OCR job storage is required")
        if not os.path.isfile(file_path):
            raise ValueError("OCR source file does not exist")
        job_id = job_store.begin_submission()
        if job_id is None:
            try:
                job_id = self._submit_file(file_path)
                if not isinstance(job_id, str) or not job_id.strip() or len(job_id) > 255:
                    raise RuntimeError("Invalid OCR job ID")
            except OcrSubmissionRejected:
                raise
            except Exception:
                # A timeout or malformed success response may follow a paid submit.
                # Do not forward provider payloads (they may contain credentials).
                raise OcrSubmissionUncertain("OCR submission outcome requires reconciliation") from None
            job_store.record_job(job_id)
        jsonl_url = self._poll_until_done(job_id)
        return self._fetch_result(jsonl_url)

    def _submit_file(self, file_path: str) -> str:
        """上传本地文件提交 OCR job"""
        data = {
            "model": MODEL,
            "optionalPayload": json.dumps(self.options),
        }
        with open(file_path, "rb") as f:
            files = {"file": f}
            resp = httpx.post(
                JOB_URL,
                headers=self._headers,
                data=data,
                files=files,
                timeout=60,
            )

        if resp.status_code in REJECTED_SUBMISSION_STATUS_CODES:
            raise OcrSubmissionRejected(resp.status_code)
        if resp.status_code != 200:
            raise RuntimeError(f"PaddleVL submit failed ({resp.status_code})")

        return resp.json()["data"]["jobId"]

    def _poll_until_done(self, job_id: str) -> str:
        """轮询 job 状态直到完成，返回结果 JSONL URL。

        Raises:
            RuntimeError: job 失败
            TimeoutError: 超过最大等待时间
        """
        start_time = time.time()

        while True:
            elapsed = time.time() - start_time
            if elapsed > POLL_TIMEOUT:
                raise TimeoutError(
                    f"PaddleVL job {job_id} timed out after {POLL_TIMEOUT}s"
                )

            resp = httpx.get(
                f"{JOB_URL}/{job_id}",
                headers=self._headers,
                timeout=30,
            )

            if resp.status_code != 200:
                raise RuntimeError(
                    f"PaddleVL poll failed ({resp.status_code})"
                )

            data = resp.json()["data"]
            state = data["state"]

            if state == "done":
                logger.info(
                    f"PaddleVL job {job_id} completed, "
                    f"pages: {data.get('extractProgress', {}).get('extractedPages', '?')}"
                )
                return data["resultUrl"]["jsonUrl"]

            if state == "failed":
                raise RuntimeError("PaddleVL job failed")

            # pending / running
            if state == "running":
                progress = data.get("extractProgress", {})
                total = progress.get("totalPages", "?")
                extracted = progress.get("extractedPages", "?")
                logger.debug(f"PaddleVL job {job_id} running: {extracted}/{total}")

            time.sleep(POLL_INTERVAL)

    def _fetch_result(self, jsonl_url: str) -> OcrResult:
        """下载并解析 JSONL 结果"""
        resp = httpx.get(jsonl_url, timeout=60)
        resp.raise_for_status()

        pages: list[OcrPage] = []
        for line_num, line in enumerate(resp.text.splitlines(), start=1):
            if not line.strip():
                continue

            # A bad record is not an empty page: skipping it silently changes all
            # subsequent page numbers and can attach OCR text to the wrong image.
            try:
                record = json.loads(line)
                if not isinstance(record, dict) or not isinstance(record.get("result"), dict):
                    raise ValueError("missing result object")
                layouts = record["result"].get("layoutParsingResults")
                if not isinstance(layouts, list) or not layouts:
                    raise ValueError("missing page results")
                for layout in layouts:
                    if not isinstance(layout, dict) or not isinstance(layout.get("markdown"), dict):
                        raise ValueError("missing page markdown")
                    markdown = layout["markdown"]
                    text = markdown.get("text")
                    images = markdown.get("images", {})
                    if not isinstance(text, str):
                        raise ValueError("page text must be a string")
                    if not isinstance(images, dict) or any(
                        not isinstance(key, str) or not isinstance(url, str)
                        for key, url in images.items()
                    ):
                        raise ValueError("page images must map paths to URLs")
                    # The service returns layouts in source order. When its
                    # pruned result supplies zero-based page identities, never
                    # renumber missing, repeated, or shuffled pages as success.
                    pruned = layout.get("prunedResult", {})
                    if not isinstance(pruned, dict):
                        raise ValueError("invalid pruned page result")
                    page_index = pruned.get("page_index")
                    if page_index is not None and (
                        type(page_index) is not int or page_index != len(pages)
                    ):
                        raise ValueError("page indices are not in source order")
                    pages.append(OcrPage(len(pages) + 1, text, images))
            except ValueError as exc:
                raise RuntimeError(f"Invalid PaddleVL JSONL result at line {line_num}") from exc

        if not pages:
            raise RuntimeError("PaddleVL returned no page results")
        return OcrResult(pages=pages, total_pages=len(pages))
