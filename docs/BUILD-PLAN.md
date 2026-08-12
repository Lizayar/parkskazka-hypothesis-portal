# Расширенный план сборки портала

Этот документ переводит [полную спецификацию](PORTAL-SPEC.md) в последовательность поставляемых инкрементов. Каждый этап заканчивается работающим, тестируемым результатом и может быть принят отдельно.

## Принятые границы

- Репозиторий публичный: в Git попадают только код, документация, миграции, fixtures без персональных данных и `.env.example` с безопасными именами переменных.
- Авторизация OAuth/OIDC. Для первого релиза рекомендуется GitHub OAuth и allowlist GitHub user IDs; password login не реализуется.
- Production secrets находятся в secret manager/CI secrets; не в issue, PR, logs, seed или frontend bundle.
- Все рекламные коннекторы в MVP read-only. Mutation endpoints отсутствуют на уровне adapter interface.
- Каноническое хранилище — PostgreSQL; raw responses — object storage; jobs — durable queue.
- Платформа запуска должна поддерживать web, API, worker, PostgreSQL, Redis и S3-compatible storage; конкретный cloud выбирается до production task.

## Milestone map

| Milestone | Результат | Приёмка |
|---|---|---|
| M0 | Decision log, OAuth/security contract, source capability checklist | нет незафиксированных security decisions |
| M1 | Public-safe monorepo, CI, local stack | clean install, lint, typecheck, tests, secret scan |
| M2 | OAuth, RBAC, audit | allowlisted user signs in; denied user cannot read workspace |
| M3 | Domain schema and migrations | fresh DB migrates and passes relational fixtures |
| M4 | Ingestion foundation | idempotent snapshot/run/quality lifecycle |
| M5 | Source adapters | each source returns normalized fixture or explicit `unsupported` |
| M6 | Measurement engine | rates, attribution, maturity and decisions reproduce fixtures |
| M7 | Portal UI | summary → explorer → hypothesis → decision flow works |
| M8 | Production hardening | backup/restore, security, observability, E2E and pilot pass |

## Phase 0 — Security and product decisions

1. Confirm target GitHub repository and branch policy.
2. Create GitHub OAuth application with callback URLs only for local and production origins.
3. Record provider scopes: identity and email only; no repository write scope is needed for portal login.
4. Define allowlist by immutable provider user ID, not display name.
5. Define first admin bootstrap as an environment-managed allowlist entry or one-time invite consumed once; no password seed exists.
6. Define environments: `local`, `staging`, `production`; each has separate OAuth client, database, storage and encryption key.
7. Confirm source accounts, timezone `Europe/Moscow`, currency, UTM convention, primary goals and Telegram channel/bot destination.

Exit evidence: accepted ADR, threat model, OAuth callback matrix, source capability checklist and rotation/revoke procedure.

## Phase 1 — Repository and delivery foundation

Create the pnpm TypeScript workspace, `apps/web`, `apps/api`, `apps/worker`, and packages for domain, database, adapters, config and UI. Add protected `main`, short-lived feature branches, pull request checks, Dependabot/Renovate policy, CodeQL/secret scanning and reproducible lockfile installs.

Exit evidence: new clone installs with `pnpm install --frozen-lockfile`, runs lint/typecheck/unit tests, starts local dependencies with Docker Compose and contains no secret-shaped values.

## Phase 2 — Identity, authorization and audit

Implement OAuth callback, signed HttpOnly session cookie, CSRF/state/nonce validation, session rotation, logout/revoke and role checks. Roles: `owner`, `analyst`, `marketer`, `reviewer`, `viewer`, `service`. Resource checks apply to workspace, brand and source account. Every auth and mutation event writes an audit record with actor, request ID and reason.

Exit evidence: allowlisted GitHub OAuth login works, non-allowlisted user receives a generic denial, viewer cannot create/approve/decide, revoked session cannot access API, and no token is returned to browser JavaScript.

## Phase 3 — Domain model and database

Implement entities from `CONTEXT.md`: workspace, brand, offer, source account, campaign, ad group, ad, creative, component, hypothesis, test, cell, exposure, metric definition, observation, snapshot, sync run, measurement run, decision and audit event.

Rules:

- external IDs are namespaced by source/account;
- historical objects use validity ranges and version rows;
- snapshots and decisions are append-only;
- facts store numerator, denominator, value, currency, timezone, attribution model and calculation version;
- foreign keys and unique idempotency keys prevent duplicate ingestion.

Exit evidence: clean database migrates from zero, fixture hierarchy loads, invalid duplicate and orphan writes fail with tested errors.

## Phase 4 — Ingestion foundation

Create the adapter contract, sync-run state machine, raw snapshot writer, object-storage checksum, schema validator, normalizer, identity resolver, quality verdict and backfill scheduler. Every run is keyed by source/account/period/capability version and can be retried safely.

Run states: `queued`, `running`, `partial`, `succeeded`, `failed`, `needs_attention`, `superseded`.

Quality states: `pass`, `warning`, `fail`, `quarantine`.

Exit evidence: same fixture imported twice yields one logical fact set, changed fixture creates a new superseding snapshot, partial source blocks decision mart but preserves diagnostics.

## Phase 5 — Source adapters

Implement sources in this order:

1. **Yandex Metrica** — Reports API for aggregate/time reports, Logs API only where raw event stitching is needed; include OAuth, data lag, sampling and limited-disclosure fields.
2. **Avito Ads** — OAuth client credentials, campaigns/groups/creatives/statistics read scope, pagination and rate-limit handling.
3. **VK Ads** — capability discovery against the actual account; support API only after contract validation, otherwise validated CSV/XLSX import with period/currency/schema checks.
4. **Telegram Ads** — read capability spike first; preserve ad text, destination, channel targeting, CPM, budget, views and joins/bot starts; use manual export fallback when no supported API is available.

Each adapter must expose the same interface and return `unsupported` rather than inventing fields. No adapter contains budget, bid, status-change or publish methods.

Exit evidence: one fixture and one failure fixture per source; connector health shows auth, rate limit, freshness, schema version and capabilities.

## Phase 6 — Metrics, attribution and decision engine

Implement metric registry and calculation pipeline. Rates are calculated from aggregated numerators/denominators. Keep platform-reported conversions separate from Metrica conversions. Every result includes attribution model, conversion window, timezone, source snapshots, match rate, lag, quality, maturity and calculation version.

Implement:

- primary, diagnostic and guardrail metrics;
- baseline and control comparison;
- `randomized_split`, `holdout`, `rotation_within_group`, `geo_split`, `time_split`, `observational` designs;
- maturity gates for days, impressions, clicks, spend and conversions;
- delivery bias and rotation imbalance checks;
- `scale`, `iterate`, `stop`, `continue`, `inconclusive` decision rules;
- idempotent measurement runs and immutable decision explanations.

Exit evidence: hand-calculated fixtures match engine output; quality fail, insufficient maturity and invalid control cannot produce `scale`.

## Phase 7 — Hypothesis and experiment workflow

Implement CRUD and state transitions for hypotheses, approval/review, test cells, rotation exposures, comments, evidence links and decisions. Require one `variable_under_test`, owner, start/end, primary metric, guardrails, baseline/control, expected delta, minimum sample and stop rules before approval.

Implement creative lineage and replacement batch generation as local drafts only: a confirmed underperformer produces exactly A/B/C, each with one changed variable, parent ID, diagnostic reason and policy/brand status.

Exit evidence: API rejects incomplete hypotheses, audit records every approved edit, one valid test reaches decision, invalid rotation blocks causal recommendation, generation is idempotent.

## Phase 8 — Portal UI

Build screens in this order:

1. App shell, workspace switcher, role-aware navigation and global filters.
2. Summary dashboard with freshness/quality badges and date range.
3. Campaign explorer with hierarchy and settings history.
4. Hypothesis board, detail, approval and decision timeline.
5. Rotation monitor with target/actual allocation and delivery bias.
6. Creative Lab with previews, component lineage, coverage matrix and policy checks.
7. Data Quality and Integrations pages with sync runs, capabilities and re-auth action.

All filters are URL-addressable and shareable. UI never calls source APIs directly and never renders raw tokens or sensitive payloads.

Exit evidence: Playwright flow from login to filtered summary to hypothesis decision works for owner, analyst, reviewer and viewer personas.

## Phase 9 — Observability and operations

Add structured logs with redaction, metrics for sync latency/rows/lag/match rate, traces by `run_id`, health/readiness endpoints, queue retry policy, dead-letter inspection, source stale alerts, decision-due alerts and credential-expiry alerts.

Define retention: raw snapshots and audit events are retained according to approved policy; local dev data is disposable; production deletion is an audited administrative operation.

Exit evidence: synthetic failed sync creates an alert, trace links UI request to worker run, dead-letter job can be replayed safely, logs contain no token/password/cookie.

## Phase 10 — Production hardening and pilot

Run migration rehearsal, backup/restore, dependency audit, SAST/DAST, CSRF/session tests, rate-limit tests, load test on summary/explorer, accessibility audit, mobile smoke and browser compatibility checks. Run a 7-day read-only pilot with one source first, then add sources after reconciliation.

Exit evidence: restore to a clean database succeeds, pilot reports match source exports within agreed tolerance, all quality warnings are explained, and a rollback/runbook exists.

## Phase 11 — Public GitHub release

- Protect `main`; require CI, review and secret scan.
- Publish architecture and local setup without account IDs that are not public.
- Keep `.env.example` limited to variable names and safe examples.
- Enable Dependabot/Renovate, CodeQL, secret scanning and push protection.
- Tag a release only after security and pilot acceptance.
- Keep production deployment configuration outside the public repository or encrypted in the deployment platform.

## Required environment variables (names only)

```text
APP_BASE_URL
DATABASE_URL
REDIS_URL
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_ACCESS_KEY_ID
OBJECT_STORAGE_SECRET_ACCESS_KEY
SESSION_ENCRYPTION_KEY
AUTH_GITHUB_ID
AUTH_GITHUB_SECRET
AUTH_ALLOWED_GITHUB_IDS
```

Values are injected by local secret store, CI secret store or production secret manager. None are committed.

## Definition of Done for the portal

The portal is ready for a controlled pilot when:

- OAuth-only access and deny-by-default RBAC are verified;
- no secrets are present in Git history, build artifacts or browser responses;
- all four source adapters report honest capabilities and preserve raw evidence;
- a user can trace a summary number to a snapshot, object, creative, hypothesis, test cell and decision;
- incomplete data cannot produce a scale recommendation;
- duplicate syncs and duplicate decisions are idempotent;
- backup/restore, security, accessibility, E2E and reconciliation checks have evidence;
- the public repository has a documented local runbook and no private production configuration.


