import os
import subprocess
import uuid

from worker.converters import ConvertResult, DocumentConverter, OutputFormat


class PptToPdfConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["pptx"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PDF

    def convert(self, input_path: str, output_dir: str) -> ConvertResult:
        result = subprocess.run(
            [
                "libreoffice",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                output_dir,
                input_path,
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            raise RuntimeError(f"LibreOffice conversion failed: {result.stderr}")

        base_name = os.path.splitext(os.path.basename(input_path))[0]
        output_path = os.path.join(output_dir, f"{base_name}.pdf")

        if not os.path.exists(output_path):
            raise RuntimeError("LibreOffice did not produce output file")

        final_name = f"{uuid.uuid4()}.pdf"
        final_path = os.path.join(output_dir, final_name)
        os.rename(output_path, final_path)

        file_size = os.path.getsize(final_path)
        return ConvertResult(
            output_path=final_path,
            file_size=file_size,
            metadata={"engine": "libreoffice"},
        )
