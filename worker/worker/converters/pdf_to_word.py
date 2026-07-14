import os
import uuid

import fitz  # PyMuPDF
from docx import Document
from docx.shared import Pt

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
            blocks = page.get_text("blocks")
            for block in blocks:
                text = block[4].strip()
                if text:
                    p = doc.add_paragraph(text)
                    for run in p.runs:
                        run.font.size = Pt(11)
            if page_num < len(pdf) - 1:
                doc.add_page_break()

        output_name = f"{uuid.uuid4()}.docx"
        output_path = os.path.join(output_dir, output_name)
        doc.save(output_path)
        pdf.close()

        file_size = os.path.getsize(output_path)
        return ConvertResult(
            output_path=output_path,
            file_size=file_size,
            page_count=len(pdf),
            metadata={"engine": "pymupdf"},
        )
