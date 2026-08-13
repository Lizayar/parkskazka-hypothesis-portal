# Threat model публичного портала

Статус: accepted baseline для Task 1. Модель будет расширяться при добавлении API, БД и source adapters.

## Системные границы

Публичный GitHub repository содержит код, документацию, migrations и synthetic fixtures без персональных данных. Runtime состоит из web, API, worker, PostgreSQL, Redis и S3-compatible object storage. Рекламные кабинеты подключаются только backend adapters в read-only режиме.

Вне публичного репозитория остаются OAuth secrets, session encryption key, source credentials, raw exports, account IDs с ограниченным доступом, production database/storage и browser profile state.

## Assets

| Asset | Почему защищаем | Каноническая граница |
|---|---|---|
| OAuth client secret | Позволяет impersonation/flow abuse | Secret manager, backend-only |
| Provider access token | Доступ к identity/source API | Server-side encrypted store; не в browser |
| Session record/key | Доступ к workspace | HttpOnly cookie + server-side session/revoke |
| Source account credentials | Доступ к рекламным данным | Per-account secret, scoped read-only adapter |
| Raw snapshots | Содержат потенциально чувствительные campaign/ad данные | Private object storage, retention policy |
| Hypotheses and decisions | Маркетинговая и коммерческая информация | RBAC + workspace/brand scope |
| Audit events | Доказательство доступа и решений | Append-only database, redacted fields |

## Actors and trust levels

- **Owner/analyst/reviewer/viewer** — authenticated human with role-scoped access.
- **Service worker** — non-human principal with source-specific least privilege.
- **GitHub** — external identity provider; provider claims are untrusted until issuer, audience, nonce and subject checks pass.
- **Source APIs** — external data providers; responses are untrusted input and pass schema/quality gates.
- **Anonymous internet user** — may read only explicitly public documentation, never workspace data.

## Primary threats and controls

| Threat | Control | Evidence |
|---|---|---|
| Password reuse or leaked bootstrap password | No password login; OAuth-only contract; no password seed | `security-contract.test.ts`, OAuth ADR |
| Account takeover through forged callback | state/nonce, exact redirect URI, issuer/audience/subject validation | Task 3 auth tests |
| Unauthorized user enters workspace | Immutable provider subject-ID allowlist, deny-by-default RBAC | Task 3 auth/RBAC tests |
| Session theft or fixation | Opaque server session, HttpOnly/Secure/SameSite, rotation and revoke | Task 3 session tests |
| CSRF on approvals/decisions | CSRF token/origin checks on state-changing routes; read-only adapters | API security tests |
| Token leakage to browser/logs | backend-only token exchange, redaction, no token in JSON/URL/cookie | secret scan + response tests |
| Malicious or malformed source response | schema validation, raw evidence checksum, quarantine quality state | ingestion tests |
| Cross-workspace data leak | resource-scoped permission check on every read/write | RBAC/row-scope tests |
| False scale recommendation | maturity, quality, control, delivery-bias and guardrail gates | measurement fixtures |
| Public repository secret disclosure | placeholders only, secret scan, push protection and review | CI + pre-commit checks |
| Replay/duplicate ingestion | idempotency keys and append-only snapshots | ingestion tests |
| Oversharing diagnostics | generic auth denial and redacted audit messages | auth audit tests |

## Security invariants

1. A provider display name, email or username can never grant access by itself.
2. No browser response contains provider access tokens, client secrets or source credentials.
3. Every state-changing action has an authenticated actor, scoped permission, request ID and audit event.
4. Read-only adapters have no publish, bid, budget, status-change or delete method.
5. `scale` is impossible when quality fails, maturity is insufficient, control is invalid, delivery is biased or guardrails breach.
6. Raw snapshots are immutable; correction creates a superseding snapshot and does not overwrite evidence.

## Incident and recovery expectations

- Revoke provider OAuth app/client secret if compromise is suspected.
- Rotate session encryption and invalidate all sessions.
- Disable affected source account adapter and quarantine new snapshots.
- Preserve redacted audit trail and snapshot checksums.
- Restore PostgreSQL/object storage only through audited operational runbook.

## Task 1 residual risks

- OAuth provider application and production callback domain are not yet registered.
- Runtime callback/session/RBAC are intentionally not implemented in this task.
- Secret scanning is local until CI workflow is added in Task 2.

