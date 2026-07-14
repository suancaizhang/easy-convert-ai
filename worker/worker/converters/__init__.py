from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class OutputFormat(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    XLSX = "xlsx"
    PPTX = "pptx"
    PNG = "png"
    JPG = "jpg"


@dataclass
class ConvertResult:
    output_path: str
    file_size: int
    page_count: int = 0
    output_paths: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


class DocumentConverter(ABC):
    @abstractmethod
    def convert(self, input_path: str, output_dir: str) -> ConvertResult:
        ...

    @property
    @abstractmethod
    def input_formats(self) -> list[str]:
        ...

    @property
    @abstractmethod
    def output_format(self) -> OutputFormat:
        ...
