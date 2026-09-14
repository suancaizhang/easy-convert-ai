# ADR 0001: Multi-file Task uses first Document as document_id anchor

**Status**: Accepted  
**Date**: 2026-07-16

## Context

`Task.document_id` is a non-null FK to `documents`. Multi-file operations (e.g. `pdf_merge`) need to reference multiple Documents. A new `source_document_ids` JSONB array was added for this. The question is what `document_id` should point to in these tasks.

## Decision

For multi-file tasks, `document_id` points to the first Document in `source_document_ids`. `source_document_ids` is the authoritative input list; `document_id` exists solely to satisfy the non-null FK constraint and serves as a "primary file" anchor (e.g. for quota refund, ownership checks).

## Alternatives Considered

- **Make `document_id` nullable** — requires a migration and breaks existing queries that assume non-null.
- **Create a separate join table** — over-engineered for Phase 1; DECISIONS.md explicitly ruled this out (decision #21).

## Consequences

- Callers must check `source_document_ids` first when resolving input files for a Task.
- `document_id` alone is not sufficient to determine all inputs for multi-file tasks.
- No schema migration needed beyond adding `source_document_ids`.
