# ADR 0004: Explicit task ownership, durable delivery and artifact lists

**Status**: Accepted  
**Date**: 2026-09-12

## Context

The full-project audit reproduced anonymous access to registered-user tasks, paid OCR without login, retries refunded before completion, cancelled tasks running again, and multi-page output exceeding a 512-character database field. API and Worker currently share PostgreSQL but not the result directory in Docker.

The source document anchor defined in ADR 0001 is useful for naming and input association; it cannot also represent who created or paid for a task. A nullable document owner is not permission to access an authenticated user's task.

## Decision

- Keep ADR 0001's anchor and ordered source list, and ADR 0002's single OCR task type. Enforce ADR 0003's OCR login boundary on the API before side effects; non-OCR guest policy is unchanged.
- Store new tasks' creator `user_id` explicitly. Owned sources require the matching authenticated user. All input documents are checked; missing/invalid authentication cannot bypass an owned task's authorization. Migration derives legacy ownership from all sources, not only the anchor: one non-null owner becomes the task owner; conflicting owners or missing sources are quarantined as `ERR_ACCESS` and deny ordinary access/deletion until reconciled. Legacy all-guest tasks cannot reveal their original creator and retain the existing UUID-capability policy.
- Store `quota_date` only when this task really consumed a quota unit; `quota_refunded` records settlement. Charge/reset/create are one transaction; final failure/cancellation refunds at most once and only against the original UTC quota date. Historical tasks have no fabricated charge record.
- Use waiting tasks with null `dispatched_at` as the durable delivery intent. `python -m app.dispatcher` sends them using the database UUID as the Celery task ID, and records dispatch after sending. A send/commit crash can duplicate delivery, not lose the intent.
- Serialize Worker execution per task with a PostgreSQL advisory lock held across the conversion. Task row locks arbitrate waiting cancellation versus execution. Terminal tasks do not execute again. Database failures requeue the message through `Reject(requeue=True)` and never settle through a reconnected session without reacquiring its lock. Celery Retry is control flow, not final failure; failed retry publication restores the durable dispatch intent. An uncertain success commit preserves possibly published output files rather than deleting them.
- Preserve the existing externally observed task states. Cancellation remains `failed` with `ERR_CANCELLED`; no unhandled new client status is introduced.
- Replace `result_path` with `result_paths`, a JSONB array of complete paths. Migrate existing comma-separated values, then remove the obsolete field. Consumers use the list for download, per-page access and deletion; status endpoints do not expose physical paths.
- New output is under `RESULT_DIR`, default `/tmp/results`, mounted into API and Worker as the same shared volume. Old container-local output requires an explicit file/data migration; SQL migration cannot copy files from another container.

## Alternatives Considered

- **Only fix individual owner conditionals / increase varchar length** — leaves task billing identity ambiguous, repeated authorization policies and another arbitrary multi-page ceiling.
- **Publish inside request then compensate on exceptions** — cannot resolve a process crash between database commit and message publication. A database-backed delivery intent is required.
- **Use Celery revoke as cancellation authority** — does not arbitrate a racing consumer and cannot prevent business-state resurrection. Database state is authoritative.
- **Introduce a workflow engine or generalized event framework** — unnecessary for this application's existing PostgreSQL/Celery task flow. A small dispatcher and explicit state/charge fields are sufficient.

## Consequences

- Deployment adds a dispatcher process, not another datastore. Local development must start it as well as API and Worker.
- The system provides at-least-once delivery with terminal-state/execution guards, not a false exactly-once guarantee across an external paid OCR provider. Migration 005 adds durable `ocr_job_state` and `ocr_job_id`: commit submission intent before a paid POST, then persist the returned ID before polling. Retries resume a known ID without another submit. Unknown outcomes (including a crash after intent or before persisting the ID) fail with `ERR_OCR_UNCERTAIN`, retain the original application quota charge, and require manual provider/billing reconciliation; they cannot be automatically cancelled/refunded. A known job that finally fails conversion still follows the existing application-quota refund rule; this is not a vendor refund.
- API/Worker must deploy together after migration. Historical charge facts cannot safely be inferred; operators must reconcile exceptional old tasks from actual records.
- Shared result files must be backed up with their metadata. Active-task references prevent source deletion. Completed secondary sources may be deleted while the independently owned result remains accessible; deleting an anchor deletes its tasks and artifacts except while OCR submission evidence remains unresolved or inconsistent, which requires manual reconciliation/archive first. Quarantined legacy tasks require manual reconciliation. Unknown database commit outcomes may leave orphan directories; cleanup must reconcile references before removal.
- Real PostgreSQL tests, converter integrity fixtures and frontend build/runtime checks are required; SQLite or mocked SQL cannot validate advisory/row locking and JSONB migration semantics.

See [audit and remediation evidence](../issues/04-project-audit-2026-09-12.md) and [deployment procedure](../../DEPLOYMENT.md).
