# ADR 0002: OCR uses single task_type with output_format param

**Status**: Accepted  
**Date**: 2026-07-16

## Context

OCR output was extended from DOCX-only to three formats: DOCX, TXT, and Searchable PDF. The task_type is currently `ocr_to_word`, which is misleading when output is TXT or Searchable PDF.

## Decision

Keep `ocr_to_word` as the single task_type for all OCR operations. Output format is controlled by `params.output_format` (`"docx"` | `"txt"` | `"searchable_pdf"`). Frontend renders the human-readable label from `params.output_format`, not from `task_type`.

## Alternatives Considered

- **Split into `ocr_to_docx`, `ocr_to_txt`, `ocr_to_searchable_pdf`** — cleaner naming, but the Converter still branches on output format internally; the routing gain is minimal. Adds three task_types to maintain and complicates CONVERTER_MAP with near-identical entries.

## Consequences

- `ocr_to_word` is a misleading name; callers must read `params.output_format` to know the actual output.
- If per-output-format billing or statistics are needed in the future, they must be derived from `params.output_format`, not `task_type`.
- No change to CONVERTER_MAP routing or queue assignment.
