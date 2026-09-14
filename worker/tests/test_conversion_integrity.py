"""Content-level regressions; all documents are temporary and OCR HTTP is mocked."""

import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import fitz
import httpx
from docx import Document
from PIL import Image

from worker.converters.pdf_compress import PdfCompressConverter
from worker.converters.pdf_to_word import PdfToWordConverter
from worker.converters.ocr_to_word import OcrToWordConverter
from worker.services.paddle_vl import OcrPage, OcrResult, PaddleVLService


class ConversionIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)

    def image_pdf(self, mode="RGB", color=(255, 0, 0), pages=1):
        image = Image.new(mode, (64, 64), color)
        encoded = io.BytesIO()
        image.save(encoded, format="JPEG" if mode == "CMYK" else "PNG")
        source = self.directory / "input.pdf"
        with fitz.open() as pdf:
            xref = 0
            for _ in range(pages):
                page = pdf.new_page(width=100, height=100)
                page.draw_rect(page.rect, color=None, fill=(0, 0, 1))
                xref = page.insert_image(
                    fitz.Rect(10, 10, 90, 90),
                    stream=encoded.getvalue() if not xref else None,
                    xref=xref,
                )
            pdf.save(source)
        return source

    def test_compression_preserves_rgb_on_every_shared_image_page(self):
        source = self.image_pdf(pages=3)
        with fitz.open(source) as pdf:
            self.assertEqual(len({page.get_images()[0][0] for page in pdf}), 1)
        result = PdfCompressConverter().convert(str(source), str(self.directory))
        with fitz.open(result.output_path) as pdf:
            self.assertEqual(len(pdf), 3)
            for page in pdf:
                pixel = page.get_pixmap().pixel(50, 50)
                for actual, expected in zip(pixel, (255, 0, 0)):
                    self.assertLessEqual(abs(actual - expected), 8)

    def test_shared_rgb_image_is_not_recompressed_for_each_reference(self):
        image = Image.new("RGB", (64, 64))
        image.putdata([
            ((x * 19 + y * 3) % 256, (y * 17) % 256, (x * 7) % 256)
            for y in range(64) for x in range(64)
        ])
        encoded = io.BytesIO()
        image.save(encoded, format="PNG")
        rendered = []
        for pages in (1, 5):
            source = self.directory / f"shared-{pages}.pdf"
            with fitz.open() as pdf:
                xref = 0
                for _ in range(pages):
                    page = pdf.new_page(width=64, height=64)
                    xref = page.insert_image(
                        page.rect, xref=xref,
                        stream=encoded.getvalue() if not xref else None,
                    )
                pdf.save(source)
            result = PdfCompressConverter().convert(str(source), str(self.directory))
            with fitz.open(result.output_path) as pdf:
                rendered.append(pdf[0].get_pixmap().samples)
        self.assertEqual(rendered[0], rendered[1])

    def test_compression_preserves_transparency_and_cmyk_colors(self):
        for mode, color in (("RGBA", (255, 0, 0, 128)), ("CMYK", (0, 255, 255, 0))):
            with self.subTest(mode=mode):
                source = self.image_pdf(mode, color)
                with fitz.open(source) as pdf:
                    before = pdf[0].get_pixmap().samples
                result = PdfCompressConverter().convert(str(source), str(self.directory))
                with fitz.open(result.output_path) as pdf:
                    self.assertEqual(pdf[0].get_pixmap().samples, before)

    def test_pdf_to_word_keeps_text_and_embedded_image(self):
        source = self.image_pdf()
        with fitz.open(source) as pdf:
            pdf[0].insert_text((10, 98), "Caption", fontsize=6)
            pdf.saveIncr()
        progress = []
        result = PdfToWordConverter().convert(
            str(source), str(self.directory),
            progress_callback=lambda current, total: progress.append((current, total)),
        )
        document = Document(result.output_path)
        self.assertIn("Caption", "\n".join(p.text for p in document.paragraphs))
        self.assertEqual(len(document.inline_shapes), 1)
        shape = document.inline_shapes[0]
        relation_id = shape._inline.graphic.graphicData.pic.blipFill.blip.embed
        with Image.open(io.BytesIO(document.part.related_parts[relation_id].blob)) as image:
            self.assertEqual(image.convert("RGB").getpixel((32, 32)), (255, 0, 0))
        self.assertEqual(progress, [(1, 1)])

    def test_searchable_pdf_preserves_chinese_and_original_pixels(self):
        source = self.image_pdf()
        ocr = OcrResult(pages=[OcrPage(1, "中文测试\n" + "很长的文字" * 40)], total_pages=1)
        result = OcrToWordConverter()._build_searchable_pdf(
            str(source), ocr, str(self.directory),
        )
        with fitz.open(source) as original, fitz.open(result.output_path) as pdf:
            page = pdf[0]
            self.assertIn("中文测试", page.get_text())
            self.assertEqual(len(page.search_for("中文测试")), 1)
            self.assertIn("很长的文字" * 40, page.get_text())
            self.assertEqual(page.get_pixmap().samples, original[0].get_pixmap().samples)
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    for span in line["spans"]:
                        self.assertGreater(span["size"], 0)
                        self.assertLessEqual(span["size"], 12)
                        self.assertTrue((page.rect + (-0.1, -0.1, 0.1, 0.1)).contains(fitz.Rect(span["bbox"])))

    def test_searchable_pdf_rejects_missing_or_extra_ocr_pages(self):
        source = self.image_pdf(pages=2)
        for count in (1, 3):
            with self.subTest(count=count), self.assertRaises(RuntimeError):
                OcrToWordConverter()._build_searchable_pdf(
                    str(source),
                    OcrResult([OcrPage(i + 1, "中文测试") for i in range(count)], count),
                    str(self.directory),
                )

    def test_ocr_keeps_all_three_output_formats_without_cloud_calls(self):
        source = self.directory / "input.png"
        Image.new("RGB", (100, 100), "white").save(source)
        ocr = OcrResult([OcrPage(1, "中文测试")], 1)
        for output_format, suffix in (("docx", ".docx"), ("txt", ".txt"), ("searchable_pdf", ".pdf")):
            with self.subTest(output_format=output_format), patch.dict(os.environ, {"PADDLE_OCR_TOKEN": "unit-test"}), patch(
                "worker.converters.ocr_to_word.PaddleVLService.ocr_file", return_value=ocr,
            ):
                result = OcrToWordConverter().convert(
                    str(source), str(self.directory), {"output_format": output_format},
                )
                self.assertEqual(Path(result.output_path).suffix, suffix)
                if output_format == "txt":
                    text = Path(result.output_path).read_text(encoding="utf-8")
                elif output_format == "docx":
                    text = "\n".join(p.text for p in Document(result.output_path).paragraphs)
                else:
                    with fitz.open(result.output_path) as pdf:
                        text = pdf[0].get_text()
                self.assertIn("中文测试", text)


class PaddleResultIntegrityTests(unittest.TestCase):
    @staticmethod
    def result_line(text):
        return json.dumps({"result": {"layoutParsingResults": [{"markdown": {"text": text, "images": {}}}]}}, ensure_ascii=False)

    def fetch(self, text):
        response = httpx.Response(200, text=text, request=httpx.Request("GET", "https://example.invalid/result"))
        with patch("worker.services.paddle_vl.httpx.get", return_value=response):
            return PaddleVLService("unit-test")._fetch_result("https://example.invalid/result")

    def test_invalid_middle_line_rejects_the_whole_result(self):
        for malformed in (
            "{broken", "null", "{}", '{"result": null}',
            '{"result": {"layoutParsingResults": []}}',
            '{"result": {"layoutParsingResults": {}}}',
            '{"result": {"layoutParsingResults": [null]}}',
            '{"result": {"layoutParsingResults": [{"markdown": {}}]}}',
            '{"result": {"layoutParsingResults": [{"markdown": {"text": 7}}]}}',
            '{"result": {"layoutParsingResults": [{"markdown": {"text": "x", "images": []}}]}}',
            '{"result": {"layoutParsingResults": [{"markdown": {"text": "x", "images": {"a": null}}}]}}',
        ):
            with self.subTest(malformed=malformed), self.assertRaises(RuntimeError):
                self.fetch("\n".join([self.result_line("first"), malformed, self.result_line("third")]))

    def test_valid_blank_page_is_preserved_in_order(self):
        result = self.fetch("\n".join([self.result_line("第一页"), self.result_line(""), self.result_line("第三页")]) + "\n")
        self.assertEqual([(page.page_num, page.markdown_text) for page in result.pages], [(1, "第一页"), (2, ""), (3, "第三页")])
        self.assertEqual(result.total_pages, 3)

    def test_empty_response_is_rejected(self):
        with self.assertRaises(RuntimeError):
            self.fetch("\n  \n")


if __name__ == "__main__":
    unittest.main()
