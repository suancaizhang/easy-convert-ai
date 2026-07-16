import os
import uuid

import fitz

from worker.converters import ConvertResult, DocumentConverter, OutputFormat


def parse_page_ranges(pages_str: str, total: int) -> list[int]:
    """Parse page range string like '1-3,5,7-10' into zero-based page indices."""
    result = []
    for part in pages_str.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            start_idx = max(int(start) - 1, 0)
            end_idx = min(int(end) - 1, total - 1)
            result.extend(range(start_idx, end_idx + 1))
        else:
            idx = int(part) - 1
            if 0 <= idx < total:
                result.append(idx)
    return sorted(set(result))


class PdfSplitConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["pdf"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PDF

    def convert(self, input_path: str, output_dir: str, params: dict | None = None) -> ConvertResult:
        params = params or {}
        pages_str = params.get("pages", "")

        doc = fitz.open(input_path)
        total = len(doc)

        if not pages_str:
            raise ValueError("必须指定页码范围 (params.pages)")

        pages = parse_page_ranges(pages_str, total)
        if not pages:
            raise ValueError(f"页码范围无效，文档共 {total} 页")

        output = fitz.open()
        for page_idx in pages:
            output.insert_pdf(doc, from_page=page_idx, to_page=page_idx)

        output_name = f"{uuid.uuid4()}.pdf"
        output_path = os.path.join(output_dir, output_name)
        output.save(output_path)
        page_count = len(output)
        output.close()
        doc.close()

        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=page_count,
            metadata={"engine": "pymupdf"},
        )
