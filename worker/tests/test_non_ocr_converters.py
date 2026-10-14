"""Real local documents, with no broker, database, cloud OCR or WeChat calls."""
from concurrent.futures import ThreadPoolExecutor
import io
from pathlib import Path
import shutil
from threading import Barrier
import tempfile
import unittest
from unittest.mock import patch

import fitz
from docx import Document
from PIL import Image

from worker.converters.images_to_pdf import ImagesToPdfConverter
from worker.converters.pdf_merge import PdfMergeConverter
from worker.converters.pdf_to_image import PdfToImageConverter
from worker.converters.pdf_to_word import PdfToWordConverter
from worker.converters.pdf_watermark import PdfWatermarkConverter
from worker.converters.word_to_pdf import WordToPdfConverter


class ConverterRegressions(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.out = self.root / "output"
        self.out.mkdir()

    def pdf(self, sizes):
        source = self.root / "source.pdf"
        with fitz.open() as doc:
            for width, height in sizes:
                doc.new_page(width=width, height=height)
            doc.save(source)
        return str(source)

    def test_giant_pdf_rejected_before_any_raster_allocation(self):
        source = self.pdf([(14400, 14400)])
        with patch.object(fitz.Page, "get_pixmap", side_effect=AssertionError("unsafe allocation")):
            with self.assertRaisesRegex(ValueError, "像素"):
                PdfToImageConverter().convert(source, str(self.out))
        self.assertEqual(list(self.out.iterdir()), [])

    def test_cumulative_pdf_budget_is_checked_before_first_page(self):
        source = self.pdf([(2000, 2000)] * 12)
        with patch.object(fitz.Page, "get_pixmap", side_effect=AssertionError("unsafe allocation")):
            with self.assertRaisesRegex(ValueError, "像素"):
                PdfToImageConverter().convert(source, str(self.out))
        self.assertEqual(list(self.out.iterdir()), [])

    def test_output_byte_limit_removes_partial_pngs(self):
        source = self.pdf([(100, 100), (100, 100)])
        with patch("worker.converters.pdf_to_image.MAX_OUTPUT_BYTES", 100):
            with self.assertRaisesRegex(ValueError, "输出"):
                PdfToImageConverter().convert(source, str(self.out))
        self.assertEqual(list(self.out.iterdir()), [])

    def test_webp_is_visible_in_both_image_pdf_paths(self):
        image_path = self.root / "red.webp"
        Image.new("RGB", (60, 40), (255, 0, 0)).save(image_path, lossless=True)
        for converter in (ImagesToPdfConverter(), PdfMergeConverter()):
            with self.subTest(converter=type(converter).__name__):
                result = converter.convert(str(image_path), str(self.out))
                with fitz.open(result.output_path) as pdf:
                    self.assertEqual(len(pdf), 1)
                    self.assertEqual(pdf[0].get_pixmap().pixel(20, 20), (255, 0, 0))

    def test_image_budget_rejects_before_pillow_decodes(self):
        source = self.root / "large.png"
        Image.new("RGB", (100, 100)).save(source)
        for converter in (ImagesToPdfConverter(), PdfMergeConverter()):
            with self.subTest(converter=type(converter).__name__):
                with patch("worker.converters.resource_limits.MAX_IMAGE_PIXELS", 9999):
                    with self.assertRaisesRegex(ValueError, "像素"):
                        converter.convert(str(source), str(self.out))

    def test_vector_art_survives_without_duplicating_editable_text(self):
        source = self.pdf([(300, 300)])
        with fitz.open(source) as pdf:
            page = pdf[0]
            page.draw_rect((40, 100, 140, 200), color=(1, 0, 0), fill=(1, 0, 0))
            page.insert_text((40, 50), "Editable heading")
            page.insert_text((50, 140), "Label")
            pdf.saveIncr()
        result = PdfToWordConverter().convert(source, str(self.out))
        doc = Document(result.output_path)
        text = "\n".join(p.text for p in doc.paragraphs)
        self.assertEqual(text.count("Editable heading"), 1)
        self.assertEqual(text.count("Label"), 1)
        self.assertEqual(len(doc.inline_shapes), 1)
        shape = doc.inline_shapes[0]
        relation_id = shape._inline.graphic.graphicData.pic.blipFill.blip.embed
        with Image.open(io.BytesIO(doc.part.related_parts[relation_id].blob)) as image:
            self.assertEqual(image.convert("RGB").getpixel((image.width // 2, image.height // 2)), (255, 0, 0))
            # The vector layer contains no second rendering of either text label.
            self.assertGreaterEqual(image.convert("RGB").getextrema()[0][0], 250)

    @unittest.skipUnless(shutil.which("libreoffice") or shutil.which("soffice"), "LibreOffice required")
    def test_concurrent_office_calls_keep_their_own_same_basename_content(self):
        barrier = Barrier(2)

        def convert(index):
            folder = self.root / str(index)
            folder.mkdir()
            source = folder / "shared.docx"
            document = Document()
            marker = f"PRIVATE DOCUMENT {index}"
            document.add_paragraph(marker)
            document.save(source)
            barrier.wait(timeout=10)
            result = WordToPdfConverter().convert(str(source), str(self.out))
            with fitz.open(result.output_path) as pdf:
                return marker, pdf[0].get_text()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(convert, range(2)))
        for index, (marker, text) in enumerate(results):
            self.assertIn(marker, text)
            self.assertNotIn(results[1 - index][0], text)

    def test_watermark_fits_page_and_requested_position(self):
        for rotation in (0, 90, 180, 270):
            source = self.pdf([(400, 300)])
            if rotation:
                with fitz.open(source) as pdf:
                    pdf[0].set_rotation(rotation)
                    pdf.saveIncr()
            for position in ("center", "top-left", "top-right", "bottom-left", "bottom-right"):
                for text in ("CONFIDENTIAL", "这是一个非常长的中文保密水印文字" * 4):
                    with self.subTest(rotation=rotation, position=position, text=text):
                        result = PdfWatermarkConverter().convert(source, str(self.out), {"text": text, "position": position})
                        with fitz.open(result.output_path) as pdf:
                            page = pdf[0]
                            self.assertEqual("".join(page.get_text().split()), text)
                            boxes = [fitz.Rect(s["bbox"]) * page.rotation_matrix for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]]
                            bounds = fitz.Rect(boxes[0])
                            for box in boxes:
                                bounds |= box
                            self.assertTrue(page.rect.contains(bounds), (page.rect, bounds))
                            if "top" in position:
                                self.assertLess(bounds.y1, page.rect.height / 2)
                            if "bottom" in position:
                                self.assertGreater(bounds.y0, page.rect.height / 2)
                            center_x = (bounds.x0 + bounds.x1) / 2
                            if "right" in position:
                                self.assertGreater(center_x, page.rect.width / 2)
                            if "left" in position:
                                self.assertLess(center_x, page.rect.width / 2)
                            if position == "center":
                                self.assertAlmostEqual(center_x, page.rect.width / 2, delta=2)


if __name__ == "__main__":
    unittest.main()
