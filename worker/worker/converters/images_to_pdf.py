import os
import uuid

import fitz  # PyMuPDF

from worker.converters import ConvertResult, DocumentConverter, OutputFormat


class ImagesToPdfConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["png", "jpg", "webp"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PDF

    def convert(self, input_path: str, output_dir: str) -> ConvertResult:
        # input_path is a comma-separated list of image paths, or a single path
        if "," in input_path:
            image_paths = [p.strip() for p in input_path.split(",")]
        else:
            image_paths = [input_path]

        pdf = fitz.open()
        for img_path in image_paths:
            img = fitz.open(img_path)
            rect = img[0].rect
            pdf_page = pdf.new_page(width=rect.width, height=rect.height)
            pdf_page.insert_image(rect, filename=img_path)
            img.close()

        output_name = f"{uuid.uuid4()}.pdf"
        output_path = os.path.join(output_dir, output_name)
        pdf.save(output_path)
        page_count = len(pdf)
        pdf.close()

        file_size = os.path.getsize(output_path)
        return ConvertResult(
            output_path=output_path,
            file_size=file_size,
            page_count=page_count,
            metadata={"engine": "pymupdf"},
        )
