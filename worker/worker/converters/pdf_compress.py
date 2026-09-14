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

        output_name = f"{uuid.uuid4()}.pdf"
        output_path = os.path.join(output_dir, output_name)
        with fitz.open(input_path) as doc:
            processed_xrefs = set()
            for page in doc:
                for img_info in page.get_images(full=True):
                    xref, smask = img_info[:2]
                    if xref in processed_xrefs:
                        continue
                    processed_xrefs.add(xref)

                    # JPEG cannot retain transparency. Preserve masked images and
                    # CMYK / special color spaces rather than flattening or changing
                    # their color interpretation just to reduce file size.
                    if smask or doc.xref_get_key(xref, "Mask")[0] != "null":
                        continue
                    if doc.xref_get_key(xref, "ColorSpace")[1] not in (
                        "/DeviceRGB", "/DeviceGray",
                    ):
                        continue
                    pix = fitz.Pixmap(doc, xref)
                    if pix.alpha or pix.colorspace is None:
                        continue
                    img_bytes = pix.tobytes(output="jpeg", jpg_quality=jpeg_quality)
                    # replace_image updates the filter and image dictionary as well
                    # as the stream, globally for every reference to this xref.
                    page.replace_image(xref, stream=img_bytes)

            doc.save(output_path, garbage=4, deflate=True, deflate_images=True)
            page_count = len(doc)

        return ConvertResult(
            output_path=output_path,
            file_size=os.path.getsize(output_path),
            page_count=page_count,
            metadata={"engine": "pymupdf", "quality": quality_key},
        )
