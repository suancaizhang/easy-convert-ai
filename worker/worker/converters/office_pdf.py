import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import uuid

from worker.converters import ConvertResult


def convert_office_pdf(input_path: str, output_dir: str) -> ConvertResult:
    lo_path = shutil.which("libreoffice") or shutil.which("soffice")
    if not lo_path:
        raise ValueError("LibreOffice is not installed or not in PATH")

    # LibreOffice forwards calls sharing a profile to an existing process. Both
    # the profile and intermediate basename must be private to this invocation.
    with tempfile.TemporaryDirectory(prefix="office_", dir=output_dir) as work_dir:
        profile_uri = (Path(work_dir).resolve() / "profile").as_uri()
        result = subprocess.run(
            [lo_path, f"-env:UserInstallation={profile_uri}", "--headless",
             "--convert-to", "pdf", "--outdir", work_dir, str(Path(input_path).resolve())],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            raise RuntimeError(f"LibreOffice conversion failed: {result.stderr}")
        intermediate = Path(work_dir) / f"{Path(input_path).stem}.pdf"
        if not intermediate.is_file() or not intermediate.stat().st_size:
            raise RuntimeError("LibreOffice did not produce output file")
        final_path = os.path.join(output_dir, f"{uuid.uuid4()}.pdf")
        os.replace(intermediate, final_path)

    return ConvertResult(
        output_path=final_path,
        file_size=os.path.getsize(final_path),
        metadata={"engine": "libreoffice"},
    )
