# ADR 0003: Guest access is unrestricted except for OCR

**Status**: Accepted  
**Date**: 2026-07-16

## Context

Guest (unauthenticated) users can use the platform without registering. The question is whether to apply rate limits (by IP or session) to prevent abuse.

## Decision

Guests have no quota or rate limiting for non-OCR operations. OCR requires login because it consumes a paid cloud API (PaddleOCR-VL). All other conversions and PDF tools are free for Guests.

## Alternatives Considered

- **IP-based rate limiting for all operations** — adds infrastructure complexity (Redis counter per IP) and friction for legitimate trial users. Low payoff in Phase 1 with no monetisation.
- **Session-based limits** — trivially bypassed; false sense of protection.

## Consequences

- Non-OCR operations have no server-side abuse protection in Phase 1. Acceptable given low compute cost of PDF operations.
- OCR gate-keeps registration — users who want OCR must create an account.
- If abuse becomes a problem, IP-based limiting can be added to the API middleware without changing this decision's core boundary (OCR = login required).
