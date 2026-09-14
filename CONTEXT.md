# Domain Context — easy-convert-ai

## Core Terms

**Document**
A file uploaded by a User or Guest. Tracks metadata (filename, file_type, file_size), storage location (oss_path), and lifecycle (status, expires_at). A Document is the input to a Task and never mutated after upload.

**Task**
A single unit of asynchronous work that transforms one or more Documents into a result. Identified by a `task_type` (e.g. `pdf_to_word`, `pdf_merge`). Progresses through statuses: `waiting → processing → success | failed`. Carries optional `params` (JSONB) for type-specific configuration and `source_document_ids` for multi-file operations.

**task_type**
The canonical identifier for what a Task does. Format: `<input>_to_<output>` for conversions, `pdf_<verb>` for PDF tools. The full set:
- Conversions: `pdf_to_word`, `word_to_pdf`, `excel_to_pdf`, `ppt_to_pdf`, `pdf_to_image`, `images_to_pdf`
- OCR: `ocr_to_word` (output format controlled by `params.output_format`)
- PDF Tools: `pdf_merge`, `pdf_split`, `pdf_compress`, `pdf_rotate`, `pdf_watermark`

**Converter**
A Python class responsible for one `task_type`. Accepts input path(s) and an output directory, returns a `ConversionResult`. Lives in `worker/worker/converters/`.

**ConversionResult**
The return value of a Converter. Contains `output_path` (single file) or `output_paths` (multiple files, e.g. PDF→images). May include `metadata` (e.g. `engine` used).

**Queue**
Celery routing tier. `default` queue handles all PDF tools and most conversions. `office` queue handles LibreOffice-dependent conversions (`word_to_pdf`, `excel_to_pdf`, `ppt_to_pdf`) for isolation.

**User**
An authenticated account with email/password or WeChat OpenID. Has a `role` (`free` | `premium`) and a daily quota (`daily_quota_used`, reset via `quota_reset_at`).

**Guest**
An unauthenticated session. Files stored under `/tmp/guest`. No quota tracking, no history. OCR operations require login — all other operations are unrestricted for Guests.

**Quota**
The daily limit on Task submissions per User. Deducted atomically on Task creation, refunded on final failure. Not applicable to Guests.

**oss_path**
The local filesystem path where a Document's file is stored. Named `oss_path` for historical reasons — currently local storage, not object storage.

**params**
A JSONB field on Task carrying type-specific configuration. Examples:
- `pdf_merge`: `{"document_ids": ["uuid1", "uuid2"], "order": [0, 1]}`
- `pdf_split`: `{"pages": "1-3,5,7-10"}`
- `pdf_compress`: `{"quality": "low|medium|high"}`
- `pdf_rotate`: `{"angle": 90, "pages": "all|1,3,5"}`
- `pdf_watermark`: `{"text": "...", "opacity": 0.3, "position": "center"}`
- `ocr_to_*`: `{"output_format": "docx|txt|searchable_pdf"}`

**document_id**
The primary Document FK on a Task. For single-file operations, this is the input file. For multi-file operations (e.g. `pdf_merge`), this points to the first Document in `source_document_ids` — it satisfies the non-null FK constraint and serves as the "primary file" anchor. `source_document_ids` is the authoritative source list for multi-file tasks.

**source_document_ids**
A JSONB array on Task listing the UUIDs of all input Documents for multi-file operations (e.g. `pdf_merge`). When present, supersedes `document_id` as the source.

**Searchable PDF**
A PDF output variant where OCR-extracted text is overlaid as an invisible text layer on top of the original image pages. Produced by `ocr_to_word` when `params.output_format = "searchable_pdf"`. Distinct from a scanned PDF (image-only) and a native PDF (text-native).

**Tool Page**
A frontend page under `/tools/*` that hosts a single PDF tool operation. Shares the `ToolPageLayout` component.

**ToolPageLayout**
A shared React component providing the standard tool page structure: upload zone, parameter slot, submit button, polling, and download. Used by all `/tools/*` pages and `/convert`.

**Competition Release**
The formally published WeChat Mini Program submitted to the 2026 competition. It is distinct from an experience build and must satisfy the competition’s launch-window requirement.

**Demo-Scale Release**
A Competition Release intended for the competition demonstration rather than general public operation. It retains the existing task quotas and backend boundaries and makes no new long-term operations commitments.

**Personal Publisher**
The individual who controls the Mini Program account and is responsible for the Competition Release, its CloudBase environment, submission materials, and privacy disclosures.

**Competition Entry Name**
The public name submitted to the 2026 competition: “AI 文档转换”. It must be consistent across the WeChat Mini Program, review materials, Mini Program code, and the authorization letter.

**Single Participant**
The sole author and participant of the Competition Release. This person owns the entry rights and signs the competition authorization letter.

**Competition Cloud Environment**
The CloudBase environment separately managed by the Personal Publisher for the Demo-Scale Release.

**Proposed Competition File Retention Window**
A not-yet-implemented 24-hour retention target for the Demo-Scale Release. Upload metadata can record `expires_at`, but no cleanup process currently enforces expiry for unbound uploads, task inputs, or results (ADR0006).

**Proposed Conversion Record Deletion**
A not-yet-implemented operation that would remove a terminal Task together with all source Documents, results, and metadata. The current document-level delete endpoint does not provide this multi-source conversion-record guarantee (ADR0006).
