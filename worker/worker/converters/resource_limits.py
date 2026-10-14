"""Bound decoded pixel work before allocating raster buffers."""
import math

import fitz

MAX_IMAGE_PIXELS = 25_000_000
MAX_TOTAL_PIXELS = 200_000_000
MAX_OUTPUT_BYTES = 256 * 1024 * 1024


class PixelBudget:
    def __init__(self, max_pixels=None, max_total_pixels=MAX_TOTAL_PIXELS):
        self.max_pixels = MAX_IMAGE_PIXELS if max_pixels is None else max_pixels
        self.max_total_pixels = max_total_pixels
        self.total = 0

    def add(self, width: int, height: int) -> None:
        if not all(math.isfinite(value) and value > 0 for value in (width, height)):
            raise ValueError("图像像素尺寸无效")
        pixels = width * height
        if pixels > self.max_pixels:
            raise ValueError("单页像素超过安全限制，请降低分辨率或拆分页面")
        if self.total + pixels > self.max_total_pixels:
            raise ValueError("累计像素超过安全限制，请分批处理")
        self.total += pixels


def check_pdf_raster_budget(pdf, dpi: float, max_pages: int = 50) -> None:
    if not math.isfinite(dpi) or dpi <= 0:
        raise ValueError("图像分辨率无效")
    if len(pdf) > max_pages:
        raise ValueError(f"PDF 超过 {max_pages} 页限制，请分批处理")
    budget = PixelBudget()
    matrix = fitz.Matrix(dpi / 72, dpi / 72)
    for page in pdf:
        rect = page.rect * matrix
        # Match outward-rounded raster bounds, including fractional coordinates.
        budget.add(math.ceil(rect.x1) - math.floor(rect.x0), math.ceil(rect.y1) - math.floor(rect.y0))
