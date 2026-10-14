import io
import math
import os
import uuid

import fitz
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from worker.converters import ConvertResult, DocumentConverter, OutputFormat, ProgressCallback
from worker.converters.resource_limits import PixelBudget


def _vector_block(pdf, page_num, budget):
    page = pdf[page_num]
    bounds = fitz.Rect()
    for kind, bbox in page.get_bboxlog():
        if kind in ("fill-path", "stroke-path", "fill-shade"):
            bounds |= fitz.Rect(bbox)
    bounds &= page.rect * page.derotation_matrix
    if bounds.is_empty:
        return None
    # Isolate the graphical layer, not an entire-page screenshot containing
    # another copy of all the editable text and extracted embedded images.
    with fitz.open() as graphics:
        graphics.insert_pdf(pdf, from_page=page_num, to_page=page_num)
        layer = graphics[0]
        layer.set_rotation(0)
        layer.add_redact_annot(layer.rect, fill=False)
        layer.apply_redactions(images=1, graphics=0)
        raster = bounds * fitz.Matrix(150 / 72, 150 / 72)
        budget.add(math.ceil(raster.x1) - math.floor(raster.x0), math.ceil(raster.y1) - math.floor(raster.y0))
        pix = layer.get_pixmap(matrix=fitz.Matrix(150 / 72, 150 / 72), clip=bounds, alpha=False)
        if pix.is_unicolor and pix.pixel(0, 0) == (255, 255, 255):
            return None  # A white-only PDF background is already the Word page.
        return {"type": 1, "bbox": tuple(bounds), "image": pix.tobytes("png")}


def _add_text_block(doc, block, page_width):
    for line in block.get("lines", []):
        paragraph = doc.add_paragraph()
        x0, _, x1, _ = line["bbox"]
        if abs((x0 + x1) / 2 - page_width / 2) < 20 and x0 > page_width * 0.25:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif x0 > page_width * 0.6:
            paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        for span in line.get("spans", []):
            if not span.get("text"):
                continue
            run = paragraph.add_run(span["text"])
            run.font.size = Pt(span.get("size", 11))
            flags = span.get("flags", 0)
            run.bold = bool(flags & 16)
            run.italic = bool(flags & 2)
            color = span.get("color", 0)
            run.font.color.rgb = RGBColor((color >> 16) & 255, (color >> 8) & 255, color & 255)
            font_name = span.get("font", "")
            if font_name:
                run.font.name = font_name.split("+", 1)[-1]


class PdfToWordConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["pdf"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.DOCX

    def convert(
        self,
        input_path: str,
        output_dir: str,
        params: dict | None = None,
        progress_callback: ProgressCallback = None,
    ) -> ConvertResult:
        doc = Document()
        budget = PixelBudget()
        with fitz.open(input_path) as pdf:
            total = len(pdf)
            for page_num, page in enumerate(pdf):
                blocks = page.get_text(
                    "dict", flags=fitz.TEXT_PRESERVE_WHITESPACE | fitz.TEXT_PRESERVE_IMAGES
                ).get("blocks", [])
                vector = _vector_block(pdf, page_num, budget)
                if vector:
                    blocks.append(vector)
                for block in sorted(blocks, key=lambda block: (block["bbox"][1], block["bbox"][0])):
                    if block.get("type") == 1 and block.get("image"):
                        paragraph = doc.add_paragraph()
                        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        width = min(fitz.Rect(block["bbox"]).width, 6 * 72)
                        with io.BytesIO(block["image"]) as image:
                            paragraph.add_run().add_picture(image, width=Pt(width))
                    elif block.get("type") == 0:
                        _add_text_block(doc, block, page.rect.width)
                if page_num < total - 1:
                    doc.add_page_break()
                if progress_callback:
                    progress_callback(page_num + 1, total)

        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.docx")
        doc.save(output_path)
        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=total,
            metadata={"engine": "pymupdf"},
        )
