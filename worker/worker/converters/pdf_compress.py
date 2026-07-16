import os
import uuid

import fitz

from worker.converters import ConvertResult, DocumentConverter, OutputFormat

QUALITY_MAP = {
    "low": 30,
    "medium": 60,
    "high": 80,
}


class PdfCompressConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["pdf"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PDF

    def convert(self, input_path: str, output_dir: str, params: dict | None = None) -> ConvertResult:
        params = params or {}
        quality_key = params.get("quality", "medium")
        jpeg_quality = QUALITY_MAP.get(quality_key, 60)

        doc = fitz.open(input_path)

        for page in doc:
            images = page.get_images(full=True)
            for img_info in images:
                xref = img_info[0]
                pix = fitz.Pixmap(doc, xref)
                if pix.n > 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                img_bytes = pix.tobytes(output="jpeg", jpg_quality=jpeg_quality)
                doc.update_stream(xref, img_bytes)
                pix = None

        output_name = f"{uuid.uuid4()}.pdf"
        output_path = os.path.join(output_dir, output_name)
        doc.save(output_path, garbage=4, deflate=True, deflate_images=True)
        page_count = len(doc)
        doc.close()

        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=page_count,
            metadata={"engine": "pymupdf", "quality": quality_key},
        )
