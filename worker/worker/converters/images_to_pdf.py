import os
import uuid

import fitz  # PyMuPDF

from worker.converters import ConvertResult, DocumentConverter, OutputFormat, ProgressCallback
from worker.converters.image_pdf import append_image
from worker.converters.resource_limits import PixelBudget


class ImagesToPdfConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["png", "jpg", "webp"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PDF

    def convert(
        self,
        input_path: str,
        output_dir: str,
        params: dict | None = None,
        progress_callback: ProgressCallback = None,
    ) -> ConvertResult:
        # input_path is a comma-separated list of image paths, or a single path
        if "," in input_path:
            image_paths = [p.strip() for p in input_path.split(",")]
        else:
            image_paths = [input_path]

        total = len(image_paths)
        budget = PixelBudget()
        output_path = os.path.join(output_dir, f"{uuid.uuid4()}.pdf")
        with fitz.open() as pdf:
            for i, img_path in enumerate(image_paths):
                append_image(pdf, img_path, budget)
                if progress_callback:
                    progress_callback(i + 1, total)
            pdf.save(output_path)
            page_count = len(pdf)

        file_size = os.path.getsize(output_path)
        return ConvertResult(
            output_path=output_path,
            file_size=file_size,
            page_count=page_count,
            metadata={"engine": "pymupdf"},
        )
