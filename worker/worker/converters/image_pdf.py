"""Decode supported image formats through Pillow, then embed a safe PNG."""
import io
import warnings

from PIL import Image, ImageOps

from worker.converters.resource_limits import PixelBudget


def append_image(pdf, path: str, budget: PixelBudget) -> None:
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            with Image.open(path) as source:
                budget.add(*source.size)
                source.load()
                image = ImageOps.exif_transpose(source)
                try:
                    if image.mode not in ("RGB", "RGBA", "L", "LA"):
                        converted = image.convert("RGBA" if "transparency" in image.info else "RGB")
                        image.close()
                        image = converted
                    with io.BytesIO() as stream:
                        image.save(stream, format="PNG")
                        page = pdf.new_page(width=image.width * 0.75, height=image.height * 0.75)
                        page.insert_image(page.rect, stream=stream.getvalue())
                finally:
                    image.close()
        except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise ValueError("图像像素超过安全限制") from exc
