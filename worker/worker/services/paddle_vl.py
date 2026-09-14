"""PaddleOCR-VL-1.6 云服务封装

异步 API 流程：提交 job → 轮询状态 → 获取 JSONL 结果
"""

import json
import logging
import os
import time
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

    def ocr_file(self, file_path: str) -> OcrResult:
        """提交本地文件进行 OCR，阻塞等待结果返回。

        Args:
            file_path: 本地文件路径（支持图片和 PDF）

        Returns:
            OcrResult 包含每页的 markdown 文本和图片

        Raises:
            ValueError: token 未配置或文件不存在
            RuntimeError: API 调用失败或 job 执行失败
            TimeoutError: 轮询超时
        """
        if not os.path.exists(file_path):
            raise ValueError(f"File not found: {file_path}")

        job_id = self._submit_file(file_path)
        logger.info(f"PaddleVL job submitted: {job_id}")

        jsonl_url = self._poll_until_done(job_id)
        return self._fetch_result(jsonl_url)

    def ocr_url(self, file_url: str) -> OcrResult:
        """提交文件 URL 进行 OCR。

        Args:
            file_url: 可公开访问的文件 URL

        Returns:
            OcrResult
        """
        job_id = self._submit_url(file_url)
        logger.info(f"PaddleVL job submitted (URL mode): {job_id}")

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

        if resp.status_code != 200:
            raise RuntimeError(
                f"PaddleVL submit failed ({resp.status_code}): {resp.text}"
            )

        return resp.json()["data"]["jobId"]

    def _submit_url(self, file_url: str) -> str:
        """通过 URL 模式提交 OCR job"""
        headers = {**self._headers, "Content-Type": "application/json"}
        payload = {
            "fileUrl": file_url,
            "model": MODEL,
            "optionalPayload": self.options,
        }
        resp = httpx.post(JOB_URL, json=payload, headers=headers, timeout=60)

        if resp.status_code != 200:
            raise RuntimeError(
                f"PaddleVL submit failed ({resp.status_code}): {resp.text}"
            )

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
                    f"PaddleVL poll failed ({resp.status_code}): {resp.text}"
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
                error_msg = data.get("errorMsg", "Unknown error")
                raise RuntimeError(f"PaddleVL job failed: {error_msg}")

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
                    pages.append(OcrPage(len(pages) + 1, text, images))
            except ValueError as exc:
                raise RuntimeError(f"Invalid PaddleVL JSONL result at line {line_num}") from exc

        if not pages:
            raise RuntimeError("PaddleVL returned no page results")
        return OcrResult(pages=pages, total_pages=len(pages))
