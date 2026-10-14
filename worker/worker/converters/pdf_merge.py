import os
import uuid

import fitz

from worker.converters import ConvertResult, DocumentConverter, OutputFormat
from worker.converters.image_pdf import append_image
from worker.converters.resource_limits import PixelBudget


class PdfMergeConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["pdf", "png", "jpg", "webp"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PDF

    def convert(self, input_path: str, output_dir: str, params: dict | None = None) -> ConvertResult:
        paths = [p.strip() for p in input_path.split(",")]

        budget = PixelBudget()
        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.pdf")
        with fitz.open() as merged:
            for path in paths:
                ext = path.rsplit(".", 1)[-1].lower()
                if ext in ("png", "jpg", "jpeg", "webp"):
                    append_image(merged, path, budget)
                else:
                    with fitz.open(path) as doc:
                        merged.insert_pdf(doc)
            merged.save(output_path)
            page_count = len(merged)

        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=page_count,
            metadata={"engine": "pymupdf"},
        )
