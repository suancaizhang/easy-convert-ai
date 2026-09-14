"""OCR 图片转文档转换器

使用 PaddleOCR-VL-1.6 云服务进行 OCR，支持三种输出格式：
- docx（默认）：将结果 markdown 转为 Word 文档
- txt：将识别文本按页拼接写入纯文本文件
- searchable_pdf：在原始 PDF/图片上叠加隐形文字层
"""

import io
import os
import re
import uuid
import logging

import httpx
import fitz  # PyMuPDF
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from PIL import Image

from worker.converters import ConvertResult, DocumentConverter, OutputFormat
from worker.services.paddle_vl import PaddleVLService, OcrPage

logger = logging.getLogger(__name__)


class OcrToWordConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["png", "jpg", "webp", "pdf"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.DOCX

    def convert(self, input_path: str, output_dir: str, params: dict | None = None) -> ConvertResult:
        """执行 OCR 转换。

        Args:
            input_path: 输入图片/PDF 文件路径
            output_dir: 输出目录
            params: 可选参数，支持 output_format: "docx" | "txt" | "searchable_pdf"

        Returns:
            ConvertResult
        """
        token = os.environ.get("PADDLE_OCR_TOKEN", "")
        if not token:
            raise ValueError("PADDLE_OCR_TOKEN not configured")

        output_format = (params or {}).get("output_format", "docx")

        service = PaddleVLService(token=token)
        result = service.ocr_file(input_path)

        if not result.pages:
            raise RuntimeError("OCR returned no results")

        if output_format == "txt":
            return self._build_txt(result, output_dir)
        elif output_format == "searchable_pdf":
            return self._build_searchable_pdf(input_path, result, output_dir)
        else:
            return self._build_docx(result, output_dir)

    def _build_docx(self, result, output_dir: str) -> ConvertResult:
        doc = Document()
        for i, page in enumerate(result.pages):
            self._write_page_to_doc(doc, page, output_dir)
            if i < len(result.pages) - 1:
                doc.add_page_break()

        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.docx")
        doc.save(output_path)

        for f in os.listdir(output_dir):
            if f.startswith("_ocr_img_"):
                try:
                    os.remove(os.path.join(output_dir, f))
                except OSError:
                    pass

        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=result.total_pages,
            metadata={"engine": "paddle-vl-1.6"},
        )

    def _build_txt(self, result, output_dir: str) -> ConvertResult:
        parts = []
        for i, page in enumerate(result.pages):
            if result.total_pages > 1:
                parts.append(f"--- Page {i + 1} ---")
            parts.append(page.markdown_text)

        text = "\n\n".join(parts)
        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.txt")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(text)

        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=result.total_pages,
            metadata={"engine": "paddle-vl-1.6"},
        )

    def _build_searchable_pdf(self, input_path: str, result, output_dir: str) -> ConvertResult:
        ext = os.path.splitext(input_path)[1].lower()

        if ext == ".pdf":
            pdf_doc = fitz.open(input_path)
        else:
            # 图片先转为单页 PDF
            with Image.open(input_path) as image:
                img_bytes = io.BytesIO()
                image.convert("RGB").save(img_bytes, format="PDF")
            pdf_doc = fitz.open(stream=img_bytes.getvalue(), filetype="pdf")

        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.pdf")
        with pdf_doc:
            if len(result.pages) != len(pdf_doc) or result.total_pages != len(pdf_doc):
                raise RuntimeError("OCR page count does not match the source document")

            # Bundled Droid Sans Fallback: no system fonts or extra package needed.
            # TextWriter embeds a Unicode font instead of insert_text's Latin font.
            font = fitz.Font("cjk")
            for page_idx, page in enumerate(result.pages):
                pdf_page = pdf_doc[page_idx]
                lines = []
                for line in page.markdown_text.splitlines():
                    clean = re.sub(r"^#{1,6}\s+", "", line.strip())
                    clean = re.sub(r"\*\*(.+?)\*\*", r"\1", clean)
                    clean = re.sub(r"\*(.+?)\*", r"\1", clean)
                    clean = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", clean).strip()
                    if clean:
                        lines.append(clean)
                if not lines:
                    continue

                # Markdown has no bounding boxes: these are estimated line slots,
                # not a reconstruction of the original OCR selection geometry.
                # Work in unrotated coordinates, as required by PyMuPDF.
                rotation = pdf_page.rotation
                pdf_page.set_rotation(0)
                rect = pdf_page.rect
                margin = min(12, rect.width * 0.05, rect.height * 0.05)
                width = rect.width - 2 * margin
                line_height = (rect.height - 2 * margin) / len(lines)
                writer = fitz.TextWriter(rect)
                for line_idx, line in enumerate(lines):
                    fontsize = min(
                        12,
                        line_height * 0.8 / (font.ascender - font.descender),
                        width / max(font.text_length(line, fontsize=1), 1),
                    )
                    y = margin + line_idx * line_height + font.ascender * fontsize
                    writer.append((margin, y), line, font=font, fontsize=fontsize)
                writer.write_text(pdf_page, render_mode=3)
                pdf_page.set_rotation(rotation)

            pdf_doc.save(output_path, deflate=True)

        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=result.total_pages,
            metadata={"engine": "paddle-vl-1.6"},
        )

    def _write_page_to_doc(self, doc: Document, page: OcrPage, output_dir: str):
        """将单页 OCR 结果（markdown）写入 docx。

        解析 markdown 中的：
        - 标题（# ## ### ...）
        - 图片（![alt](path)）
        - 普通段落文本
        """
        lines = page.markdown_text.split("\n")

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # 检查是否为标题
            heading_match = re.match(r"^(#{1,6})\s+(.+)$", stripped)
            if heading_match:
                level = len(heading_match.group(1))
                text = heading_match.group(2).strip()
                p = doc.add_heading(text, level=min(level, 4))
                continue

            # 检查是否包含图片
            img_match = re.search(r"!\[([^\]]*)\]\(([^)]+)\)", stripped)
            if img_match:
                img_ref = img_match.group(2)
                self._insert_image(doc, img_ref, page.images, output_dir)
                # 如果图片前后有文字，也写入
                text_before = stripped[: img_match.start()].strip()
                text_after = stripped[img_match.end() :].strip()
                if text_before:
                    p = doc.add_paragraph(text_before)
                    for run in p.runs:
                        run.font.size = Pt(11)
                if text_after:
                    p = doc.add_paragraph(text_after)
                    for run in p.runs:
                        run.font.size = Pt(11)
                continue

            # 普通段落
            # 处理加粗 **text** 和斜体 *text*
            p = doc.add_paragraph()
            self._write_rich_text(p, stripped)

    def _write_rich_text(self, paragraph, text: str):
        """解析 markdown 行内格式写入段落（加粗、斜体）"""
        # 简单解析：**bold** 和 *italic*
        pattern = re.compile(r"(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))")
        for match in pattern.finditer(text):
            if match.group(2):  # **bold**
                run = paragraph.add_run(match.group(2))
                run.bold = True
                run.font.size = Pt(11)
            elif match.group(3):  # *italic*
                run = paragraph.add_run(match.group(3))
                run.italic = True
                run.font.size = Pt(11)
            elif match.group(4):  # plain text
                run = paragraph.add_run(match.group(4))
                run.font.size = Pt(11)

    def _insert_image(
        self, doc: Document, img_ref: str, images: dict[str, str], output_dir: str
    ):
        """下载并插入图片到 docx。

        Args:
            doc: docx 文档对象
            img_ref: markdown 中的图片引用路径
            images: {相对路径: 下载URL} 映射
            output_dir: 临时目录
        """
        # 从 images 映射中查找下载 URL
        download_url = images.get(img_ref, "")
        if not download_url:
            # 尝试匹配文件名部分
            img_filename = os.path.basename(img_ref)
            for key, url in images.items():
                if os.path.basename(key) == img_filename:
                    download_url = url
                    break

        if not download_url:
            logger.warning(f"Image not found in results: {img_ref}")
            return

        try:
            resp = httpx.get(download_url, timeout=30)
            resp.raise_for_status()

            img_path = os.path.join(
                output_dir, f"_ocr_img_{uuid.uuid4().hex[:8]}.png"
            )
            with open(img_path, "wb") as f:
                f.write(resp.content)

            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run()
            run.add_picture(img_path, width=Inches(5.5))
        except Exception as e:
            logger.warning(f"Failed to download/insert image {img_ref}: {e}")
