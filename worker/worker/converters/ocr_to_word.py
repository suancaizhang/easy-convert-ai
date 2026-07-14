import os
import uuid
import logging

from docx import Document
from docx.shared import Pt

from worker.converters import ConvertResult, DocumentConverter, OutputFormat

logger = logging.getLogger(__name__)


class OcrToWordConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["png", "jpg", "webp"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.DOCX

    def convert(self, input_path: str, output_dir: str, ocr_mode: str = "normal") -> ConvertResult:
        actual_engine = None
        text_content = ""

        if ocr_mode == "high_accuracy":
            try:
                text_content = self._deepseek_ocr(input_path)
                actual_engine = "deepseek"
            except Exception as e:
                logger.warning(f"DeepSeek OCR failed, falling back to PaddleOCR: {e}")
                text_content = self._paddle_ocr(input_path)
                actual_engine = "paddleocr"
        else:
            try:
                text_content = self._paddle_ocr(input_path)
                actual_engine = "paddleocr"
            except Exception as e:
                logger.warning(f"PaddleOCR failed, falling back to DeepSeek: {e}")
                text_content = self._deepseek_ocr(input_path)
                actual_engine = "deepseek"

        doc = Document()
        for line in text_content.split("\n"):
            if line.strip():
                p = doc.add_paragraph(line)
                for run in p.runs:
                    run.font.size = Pt(11)

        output_name = f"{uuid.uuid4()}.docx"
        output_path = os.path.join(output_dir, output_name)
        doc.save(output_path)

        file_size = os.path.getsize(output_path)
        return ConvertResult(
            output_path=output_path,
            file_size=file_size,
            page_count=1,
            metadata={"engine": actual_engine, "ocr_mode": ocr_mode},
        )

    def _paddle_ocr(self, image_path: str) -> str:
        from paddleocr import PaddleOCR

        ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
        result = ocr.ocr(image_path, cls=True)
        lines = []
        if result and result[0]:
            for item in result[0]:
                lines.append(item[1][0])
        return "\n".join(lines)

    def _deepseek_ocr(self, image_path: str) -> str:
        import base64
        import httpx

        api_key = os.environ.get("DEEPSEEK_API_KEY", "")
        if not api_key:
            raise RuntimeError("DEEPSEEK_API_KEY not configured")

        with open(image_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode()

        resp = httpx.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "deepseek-chat",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
                            {"type": "text", "text": "请识别图片中的所有文字，逐行输出，保持原始排版。"},
                        ],
                    }
                ],
            },
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
