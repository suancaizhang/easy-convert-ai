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


def _writer(rect, text, position):
    # The bundled CJK font avoids deployment-specific system-font availability.
    font = fitz.Font("cjk" if any(ord(char) > 127 for char in text) else "helv")
    margin = min(rect.width, rect.height) * 0.04
    max_width = rect.width - 2 * margin
    max_height = rect.height * 0.3
    size = 36.0
    while True:
        lines = []
        for paragraph in text.split("\n"):
            line = ""
            for char in paragraph:
                if line and font.text_length(line + char, fontsize=size) > max_width:
                    lines.append(line)
                    line = ""
                line += char
            lines.append(line)
        leading = (font.ascender - font.descender) * size * 1.05
        writer = fitz.TextWriter(rect)
        for index, line in enumerate(lines):
            writer.append((0, index * leading + font.ascender * size), line, font=font, fontsize=size)
        bounds = writer.text_rect
        if bounds.width <= max_width and bounds.height <= max_height:
            break
        size *= 0.85

    # TextWriter bounds include font-specific side bearings. Use the actual
    # text extents for alignment, rather than shifting CJK text off-center.
    with fitz.open() as measurement:
        sample = measurement.new_page(width=rect.width, height=rect.height)
        writer.write_text(sample)
        bounds = fitz.Rect()
        for block in sample.get_text("blocks"):
            bounds |= fitz.Rect(block[:4])

    ratio_x, ratio_y = POSITION_MAP.get(position, POSITION_MAP["center"])
    left = max(margin, min(rect.width * ratio_x - bounds.width / 2, rect.width - margin - bounds.width))
    top = max(margin, min(rect.height * ratio_y - bounds.height / 2, rect.height - margin - bounds.height))
    placed = fitz.TextWriter(rect)
    for index, line in enumerate(lines):
        placed.append((left - bounds.x0, top - bounds.y0 + index * leading + font.ascender * size),
                      line, font=font, fontsize=size)
    return placed


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
        if not text or not text.strip():
            raise ValueError("必须提供水印文字 (params.text)")
        opacity = max(0.05, min(1.0, float(params.get("opacity", 0.3))))
        position = params.get("position", "center")
        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.pdf")
        with fitz.open(input_path) as doc:
            for page in doc:
                # Compose in visible-page coordinates, including rotated pages.
                with fitz.open() as overlay:
                    layer = overlay.new_page(width=page.rect.width, height=page.rect.height)
                    _writer(layer.rect, text, position).write_text(layer, opacity=opacity, color=(0.5, 0.5, 0.5))
                    rotation = page.rotation
                    page.set_rotation(0)
                    page.show_pdf_page(page.rect, overlay, 0, rotate=rotation)
                    page.set_rotation(rotation)
            doc.save(output_path)
            page_count = len(doc)
        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=page_count,
            metadata={"engine": "pymupdf"},
        )
