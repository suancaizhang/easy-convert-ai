"""OCR completeness regressions; never calls the paid provider."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import fitz
import httpx

from worker.converters.ocr_to_word import OcrToWordConverter
from worker.services.paddle_vl import OcrPage, OcrResult, PaddleVLService


class OcrIntegrityTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.directory = Path(directory.name)
        self.source = self.directory / "source.pdf"
        with fitz.open() as pdf:
            pdf.new_page()
            pdf.new_page()
            pdf.save(self.source)
        env = patch.dict(os.environ, {"PADDLE_OCR_TOKEN": "isolated-test"})
        env.start()
        self.addCleanup(env.stop)

    def test_jpeg_source_produces_complete_text(self):
        from PIL import Image
        source = self.directory / "source.jpg"
        Image.new("RGB", (16, 16), "white").save(source)
        with patch.object(PaddleVLService, "ocr_file", return_value=OcrResult([OcrPage(1, "image text")], 1)):
            result = OcrToWordConverter().convert(str(source), str(self.directory), {"output_format": "txt"})
        self.assertEqual(Path(result.output_path).read_text(), "image text")

    def test_all_formats_reject_missing_or_reordered_source_pages(self):
        for pages in ([OcrPage(1, "first")], [OcrPage(2, "second"), OcrPage(1, "first")]):
            for output_format in ("docx", "txt", "searchable_pdf"):
                with self.subTest(output_format=output_format, pages=pages), patch.object(
                    PaddleVLService, "ocr_file", return_value=OcrResult(pages, len(pages))
                ), self.assertRaises(RuntimeError):
                    OcrToWordConverter().convert(str(self.source), str(self.directory),
                                                 {"output_format": output_format})
        self.assertEqual(list(self.directory.iterdir()), [self.source])

    def test_docx_does_not_publish_when_referenced_image_missing_or_invalid(self):
        for images in ({}, {"figure.png": "https://example.invalid/figure"}):
            result = OcrResult([OcrPage(1, "![figure](figure.png)", images), OcrPage(2, "second")], 2)
            response = httpx.Response(200, content=b"not an image", request=httpx.Request("GET", "https://example.invalid/figure"))
            with self.subTest(images=images), patch.object(PaddleVLService, "ocr_file", return_value=result), \
                 patch("worker.converters.ocr_to_word.httpx.get", return_value=response), self.assertRaises(RuntimeError):
                OcrToWordConverter().convert(str(self.source), str(self.directory))
        self.assertFalse(list(self.directory.glob("*.docx")))

    def test_docx_rejects_a_missing_second_image_on_the_same_line(self):
        result = OcrResult([OcrPage(1, "![first](first.png) ![second](second.png)",
                                   {"first.png": "https://example.invalid/first"}), OcrPage(2, "second")], 2)
        import io
        from PIL import Image
        image = io.BytesIO()
        Image.new("RGB", (8, 8), "red").save(image, "PNG")
        response = httpx.Response(200, content=image.getvalue(), request=httpx.Request("GET", "https://example.invalid/first"))
        with patch.object(PaddleVLService, "ocr_file", return_value=result), \
             patch("worker.converters.ocr_to_word.httpx.get", return_value=response), self.assertRaises(RuntimeError):
            OcrToWordConverter().convert(str(self.source), str(self.directory))
        self.assertFalse(list(self.directory.glob("*.docx")))

    def test_jsonl_rejects_duplicate_and_out_of_order_page_indices(self):
        for indices in ((0, 0), (1, 0)):
            payload = "\n".join(json.dumps({"result": {"layoutParsingResults": [
                {"prunedResult": {"page_index": index}, "markdown": {"text": str(index)}}
            ]}}) for index in indices)
            response = httpx.Response(200, text=payload, request=httpx.Request("GET", "https://example.invalid/result"))
            with self.subTest(indices=indices), patch("worker.services.paddle_vl.httpx.get", return_value=response), \
                 self.assertRaises(RuntimeError):
                PaddleVLService("isolated-test")._fetch_result("https://example.invalid/result")


    def test_explicit_provider_rejection_is_not_an_uncertain_submission(self):
        from worker.services.paddle_vl import OcrSubmissionRejected

        class JobStore:
            def begin_submission(self):
                return None

            def record_job(self, job_id):
                raise AssertionError("A rejected submission must not produce a job ID")

        response = httpx.Response(
            401,
            json={"detail": "unauthorized"},
            request=httpx.Request("POST", "https://provider.invalid/ocr/jobs"),
        )
        with patch("worker.services.paddle_vl.httpx.post", return_value=response):
            with self.assertRaises(OcrSubmissionRejected) as rejected:
                PaddleVLService("isolated-test").ocr_file(
                    str(self.source), job_store=JobStore()
                )
        self.assertEqual(rejected.exception.status_code, 401)

if __name__ == "__main__":
    unittest.main()
