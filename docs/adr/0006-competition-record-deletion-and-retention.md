# ADR 0006: Competition record deletion and 24-hour retention

**Status**: Proposed
**Date**: 2026-09-14

## Proposed contract

The Demo-Scale Release should treat a completed conversion as a single deletable record: deleting it removes its Task, every source Document, every result file, and their metadata. Active tasks must be cancelled and reach a terminal state before deletion. Uploaded Documents without a Task should expire 24 hours after upload; task inputs and results should expire 24 hours after the terminal transition.

## Current implementation gap

This contract is not implemented. The current document-level delete endpoint preserves the legacy anchor/secondary-source semantics and does not guarantee deletion of every source in a multi-file conversion. Upload metadata can contain `expires_at`, but no cleanup process consumes it, and task results do not yet have a complete terminal-state retention lifecycle. Competition privacy disclosures must describe the current behavior until the implementation and its isolated PostgreSQL/worker verification are complete.

Acceptance requires a conversion-record deletion API, terminal-state expiry calculation, an idempotent cleanup process, and deletion of all source/result files and metadata without racing active workers.

## Considered options

- **Delete one Document only** — insufficient because secondary inputs or result files can remain accessible after the user believes the conversion was removed.
- **Allow deletion during execution** — rejected because it races the Worker and can delete paths the conversion is still reading or writing.
- **Indefinite retention** — unsuitable for a competition-scale document-processing service handling potentially sensitive user files.
