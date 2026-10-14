import os
import uuid

import fitz

from worker.converters import ConvertResult, DocumentConverter, OutputFormat, ProgressCallback
from worker.converters.resource_limits import MAX_OUTPUT_BYTES, check_pdf_raster_budget

MAX_PAGES = 50


class PdfToImageConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["pdf"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PNG

    def convert(
        self,
        input_path: str,
        output_dir: str,
        params: dict | None = None,
        progress_callback: ProgressCallback = None,
    ) -> ConvertResult:
        output_paths = []
        total_size = 0
        try:
            with fitz.open(input_path) as pdf:
                check_pdf_raster_budget(pdf, dpi=150, max_pages=MAX_PAGES)
                total = len(pdf)
                matrix = fitz.Matrix(150 / 72, 150 / 72)
                for page_num, page in enumerate(pdf):
                    pix = page.get_pixmap(matrix=matrix)
                    img_path = os.path.join(output_dir, f"{uuid.uuid4()}.png")
                    output_paths.append(img_path)
                    pix.save(img_path)
                    del pix
                    total_size += os.path.getsize(img_path)
                    if total_size > MAX_OUTPUT_BYTES:
                        raise ValueError("输出文件超过安全大小限制，请分批处理")
                    if progress_callback:
                        progress_callback(page_num + 1, total)
        except Exception:
            for path in output_paths:
                if os.path.exists(path):
                    os.remove(path)
            raise

        return ConvertResult(
            output_path=output_paths[0] if output_paths else "",
            output_paths=output_paths,
            file_size=total_size,
            page_count=total,
            metadata={"engine": "pymupdf", "dpi": 150},
        )
