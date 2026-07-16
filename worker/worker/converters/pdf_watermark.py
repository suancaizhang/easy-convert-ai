import os
import uuid

import fitz

from worker.converters import ConvertResult, DocumentConverter, OutputFormat

POSITION_MAP = {
    "center": (0.5, 0.5),
    "top-left": (0.15, 0.15),
    "top-right": (0.85, 0.15),
    "bottom-left": (0.15, 0.85),
    "bottom-right": (0.85, 0.85),
}


class PdfWatermarkConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["pdf"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PDF

    def convert(self, input_path: str, output_dir: str, params: dict | None = None) -> ConvertResult:
        params = params or {}
        text = params.get("text", "")
        if not text:
            raise ValueError("必须提供水印文字 (params.text)")

        opacity = float(params.get("opacity", 0.3))
        opacity = max(0.05, min(1.0, opacity))
        position = params.get("position", "center")
        pos_ratio = POSITION_MAP.get(position, (0.5, 0.5))

        doc = fitz.open(input_path)
        font_size = 36

        for page in doc:
            rect = page.rect
            x = rect.width * pos_ratio[0]
            y = rect.height * pos_ratio[1]
            point = fitz.Point(x, y)

            tw = fitz.TextWriter(page.rect)
            tw.append(point, text, fontsize=font_size)
            tw.write_text(page, opacity=opacity, color=(0.5, 0.5, 0.5))

        output_name = f"{uuid.uuid4()}.pdf"
        output_path = os.path.join(output_dir, output_name)
        doc.save(output_path)
        page_count = len(doc)
        doc.close()

        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=page_count,
            metadata={"engine": "pymupdf"},
        )
