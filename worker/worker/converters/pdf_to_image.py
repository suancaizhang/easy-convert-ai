import os
import uuid

import fitz  # PyMuPDF

from worker.converters import ConvertResult, DocumentConverter, OutputFormat

MAX_PAGES = 50


class PdfToImageConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["pdf"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PNG

    def convert(self, input_path: str, output_dir: str, params: dict | None = None) -> ConvertResult:
        pdf = fitz.open(input_path)

        if len(pdf) > MAX_PAGES:
            pdf.close()
            raise ValueError(f"PDF 超过 {MAX_PAGES} 页限制，请分批处理")

        output_paths = []
        for page_num in range(len(pdf)):
            page = pdf[page_num]
            # 150 DPI
            mat = fitz.Matrix(150 / 72, 150 / 72)
            pix = page.get_pixmap(matrix=mat)
            img_name = f"{uuid.uuid4()}.png"
            img_path = os.path.join(output_dir, img_name)
            pix.save(img_path)
            output_paths.append(img_path)

        page_count = len(pdf)
        pdf.close()

        total_size = sum(os.path.getsize(p) for p in output_paths)
        return ConvertResult(
            output_path=output_paths[0] if output_paths else "",
            output_paths=output_paths,
            file_size=total_size,
            page_count=page_count,
            metadata={"engine": "pymupdf", "dpi": 150},
        )
