from worker.converters import ConvertResult, DocumentConverter, OutputFormat
from worker.converters.office_pdf import convert_office_pdf


class ExcelToPdfConverter(DocumentConverter):
    @property
    def input_formats(self) -> list[str]:
        return ["xlsx"]

    @property
    def output_format(self) -> OutputFormat:
        return OutputFormat.PDF

    def convert(self, input_path: str, output_dir: str, params: dict | None = None) -> ConvertResult:
        return convert_office_pdf(input_path, output_dir)
