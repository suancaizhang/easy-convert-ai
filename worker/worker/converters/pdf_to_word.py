import os
import uuid

import fitz  # PyMuPDF
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from worker.converters import ConvertResult, DocumentConverter, OutputFormat


class PdfToWordConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["pdf"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.DOCX

    def convert(self, input_path: str, output_dir: str) -> ConvertResult:
        pdf = fitz.open(input_path)
        doc = Document()

        for page_num in range(len(pdf)):
            page = pdf[page_num]
            page_width = page.rect.width

            # Extract text with formatting using "dict" mode
            page_dict = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)

            for block in page_dict.get("blocks", []):
                # Image block
                if block.get("type") == 1:
                    try:
                        img_data = block.get("image")
                        if img_data:
                            img_path = os.path.join(
                                output_dir, f"_img_{uuid.uuid4().hex[:8]}.png"
                            )
                            with open(img_path, "wb") as f:
                                f.write(img_data)
                            p = doc.add_paragraph()
                            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                            # Scale image to fit page width (max 6 inches)
                            img_width = block.get("width", 300)
                            doc_width = min(img_width * 72 / 96, 6 * 72)  # points
                            p.add_run().add_picture(img_path, width=Inches(doc_width / 72))
                    except Exception:
                        pass
                    continue

                # Text block (type == 0)
                if block.get("type") != 0:
                    continue

                for line in block.get("lines", []):
                    p = doc.add_paragraph()

                    # Detect alignment from line position
                    line_x0 = line["bbox"][0]
                    line_x1 = line["bbox"][2]
                    line_center = (line_x0 + line_x1) / 2
                    page_center = page_width / 2

                    if abs(line_center - page_center) < 20 and (line_x0 > page_width * 0.25):
                        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    elif line_x0 > page_width * 0.6:
                        p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

                    for span in line.get("spans", []):
                        text = span.get("text", "")
                        if not text:
                            continue

                        run = p.add_run(text)

                        # Font size
                        font_size = span.get("size", 11)
                        run.font.size = Pt(font_size)

                        # Bold detection (flags bit 4 = 16)
                        flags = span.get("flags", 0)
                        if flags & 16:
                            run.bold = True

                        # Italic detection (flags bit 1 = 2)
                        if flags & 2:
                            run.italic = True

                        # Font color
                        color_int = span.get("color", 0)
                        if color_int and color_int != 0:
                            r = (color_int >> 16) & 0xFF
                            g = (color_int >> 8) & 0xFF
                            b = color_int & 0xFF
                            if not (r == 0 and g == 0 and b == 0):
                                run.font.color.rgb = RGBColor(r, g, b)

                        # Font name
                        font_name = span.get("font", "")
                        if font_name:
                            # Clean up font name (remove subset prefix like ABCDEF+)
                            if "+" in font_name:
                                font_name = font_name.split("+", 1)[1]
                            run.font.name = font_name

            if page_num < len(pdf) - 1:
                doc.add_page_break()

        output_name = f"{uuid.uuid4()}.docx"
        output_path = os.path.join(output_dir, output_name)
        doc.save(output_path)
        page_count = len(pdf)
        pdf.close()

        # Clean up temporary image files
        for f in os.listdir(output_dir):
            if f.startswith("_img_"):
                try:
                    os.remove(os.path.join(output_dir, f))
                except OSError:
                    pass

        file_size = os.path.getsize(output_path)
        return ConvertResult(
            output_path=output_path,
            file_size=file_size,
            page_count=page_count,
            metadata={"engine": "pymupdf"},
        )
