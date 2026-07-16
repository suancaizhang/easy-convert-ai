import os
import uuid

import fitz

from worker.converters import ConvertResult, DocumentConverter, OutputFormat
from worker.converters.pdf_split import parse_page_ranges


class PdfRotateConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["pdf"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PDF

    def convert(self, input_path: str, output_dir: str, params: dict | None = None) -> ConvertResult:
        params = params or {}
        angle = int(params.get("angle", 90))
        if angle not in (90, 180, 270):
            raise ValueError("angle 必须为 90、180 或 270")

        pages_str = params.get("pages", "all")

        doc = fitz.open(input_path)
        total = len(doc)

        if pages_str == "all":
            target_pages = list(range(total))
        else:
            target_pages = parse_page_ranges(pages_str, total)

        for idx in target_pages:
            doc[idx].set_rotation(doc[idx].rotation + angle)

        output_name = f"{uuid.uuid4()}.pdf"
        output_path = os.path.join(output_dir, output_name)
        doc.save(output_path)
        page_count = len(doc)
        doc.close()

        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=page_count,
            metadata={"engine": "pymupdf", "angle": angle},
        )
