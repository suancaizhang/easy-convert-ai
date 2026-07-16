import os
import uuid

import fitz

from worker.converters import ConvertResult, DocumentConverter, OutputFormat


class PdfMergeConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["pdf", "png", "jpg", "webp"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PDF

    def convert(self, input_path: str, output_dir: str, params: dict | None = None) -> ConvertResult:
        paths = [p.strip() for p in input_path.split(",")]

        merged = fitz.open()
        for path in paths:
            ext = path.rsplit(".", 1)[-1].lower()
            if ext in ("png", "jpg", "jpeg", "webp"):
                img = fitz.open(path)
                rect = img[0].rect
                page = merged.new_page(width=rect.width, height=rect.height)
                page.insert_image(rect, filename=path)
                img.close()
            else:
                doc = fitz.open(path)
                merged.insert_pdf(doc)
                doc.close()

        output_name = f"{uuid.uuid4()}.pdf"
        output_path = os.path.join(output_dir, output_name)
        merged.save(output_path)
        page_count = len(merged)
        merged.close()

        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=page_count,
            metadata={"engine": "pymupdf"},
        )
