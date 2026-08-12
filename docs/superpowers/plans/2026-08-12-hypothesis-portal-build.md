# Hypothesis Portal Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with a fresh verification checkpoint after every task.

**Goal:** Build a public-safe, OAuth-only, read-only analytics portal for Park Skazka that turns VK Ads, Yandex Metrica, Avito Ads and Telegram Ads evidence into time-bounded hypotheses, experiments, measurements and decisions.

**Architecture:** A pnpm TypeScript monorepo contains a Next.js web app, a Fastify API, a worker service, pure domain packages, a PostgreSQL/Drizzle data layer, adapter packages and a Redis-backed durable queue. Source APIs are accessed only by backend adapters; immutable raw snapshots live in S3-compatible storage, while PostgreSQL stores canonical entities, facts, experiment lineage, quality verdicts and audit events.

**Tech Stack:** Node.js 22 LTS, pnpm 10, TypeScript strict mode, Next.js App Router, Fastify, Drizzle ORM, PostgreSQL 16, Redis 7, S3-compatible object storage, Auth.js/OIDC with GitHub OAuth for the first provider, Vitest, Playwright, Testcontainers, OpenAPI, Docker Compose and GitHub Actions.

## Global Constraints

- Public repository: no passwords, tokens, cookies, production IDs, raw exports or personal data in Git.
- Authentication: OAuth/OIDC only; no password login or hardcoded bootstrap credential.
- Authorization: deny by default, immutable provider user ID allowlist, workspace/brand/source-account scopes.
- Advertising platforms: read-only adapter contract; no mutation methods in MVP.
- Time: default `Europe/Moscow`; store UTC timestamps plus source timezone.
- Data: preserve raw snapshots, source semantics, numerators/denominators, attribution context and calculation version.
- Decisions: `scale` is blocked by quality failure, insufficient maturity, invalid control, delivery bias or guardrail breach.
- Testing: every task ends with a focused test command and a repository-wide verification command.
- Delivery: each accepted task gets a focused commit; never commit credentials to make a test pass.

---

### Task 1: Lock repository, threat model and OAuth contract

**Files:**
- Create: `docs/SECURITY-THREAT-MODEL.md`
- Create: `docs/OAUTH-CONTRACT.md`
- Create: `docs/adr/0003-oauth-only-public-repository.md`
- Create: `packages/config/src/security-contract.ts`
- Modify: `README.md`
- Test: `tests/docs/security-contract.test.ts`

**Interfaces:**
- Produces `OAuthProviderConfig`: `{ issuer: string; clientIdEnv: string; clientSecretEnv: string; redirectUris: string[]; scopes: string[]; allowedSubjectIdsEnv: string }`.
- Produces security decisions: OAuth-only, GitHub provider for first release, provider subject ID allowlist, one-time invite/admin bootstrap, no password auth.

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from "vitest";
import { readSecurityContract } from "@portal/config/security-contract";

describe("public repository security contract", () => {
  it("forbids password authentication and requires OAuth scopes", () => {
    const contract = readSecurityContract();
    expect(contract.authentication).toBe("oauth_oidc_only");
    expect(contract.passwordLogin).toBe(false);
    expect(contract.scopes).toEqual(["openid", "profile", "email"]);
  });
});
```

- [ ] **Step 2: Run test and confirm it fails**

Run: `pnpm vitest run tests/docs/security-contract.test.ts`
Expected: FAIL because the monorepo and contract module do not exist.

- [ ] **Step 3: Write the contract and threat model**

Document public-repository boundaries, OAuth redirect validation, CSRF/state/nonce, session rotation, provider-ID allowlist, revoke flow, secret storage, audit requirements and the rule that the user-supplied password is not persisted.

- [ ] **Step 4: Run the focused test**

Run: `pnpm vitest run tests/docs/security-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/SECURITY-THREAT-MODEL.md docs/OAUTH-CONTRACT.md docs/adr/0003-oauth-only-public-repository.md packages/config/src/security-contract.ts README.md tests/docs/security-contract.test.ts
git commit -m "docs: lock public repository oauth security contract"
```

### Task 2: Bootstrap monorepo, local services and CI

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.editorconfig`
- Create: `apps/web/`, `apps/api/`, `apps/worker/`
- Create: `packages/config/`, `packages/domain/`, `packages/db/`, `packages/adapters/`, `packages/ui/`
- Create: `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`
- Test: `tests/tooling/workspace.test.ts`

**Interfaces:**
- `packages/config/src/env.ts` exports `loadServerEnv(input: NodeJS.ProcessEnv): ServerEnv` and rejects missing production secrets.
- `packages/config/src/public-env.ts` exports only browser-safe configuration.
- Root scripts: `lint`, `typecheck`, `test`, `test:e2e`, `db:migrate`, `dev`.

- [ ] **Step 1: Write the failing workspace test**

```ts
it("exposes only browser-safe public configuration", () => {
  const env = loadPublicEnv({ NEXT_PUBLIC_APP_NAME: "Hypothesis Portal", AUTH_GITHUB_SECRET: undefined });
  expect(env).toEqual({ appName: "Hypothesis Portal" });
  expect(JSON.stringify(env)).not.toContain("AUTH_GITHUB_SECRET");
});
```

- [ ] **Step 2: Run it and confirm missing packages fail**

Run: `pnpm vitest run tests/tooling/workspace.test.ts`
Expected: FAIL because workspace files do not exist.

- [ ] **Step 3: Implement workspace and local infrastructure**

Create strict TypeScript packages, Docker services for PostgreSQL/Redis/MinIO, safe `.env.example` variable names, and CI jobs for install, lint, typecheck, unit tests, secret scan and dependency audit.

- [ ] **Step 4: Run local foundation checks**

Run: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test`
Expected: PASS with no secret values and no network-dependent unit tests.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .editorconfig apps packages docker-compose.yml .env.example .github tests/tooling
git commit -m "chore: bootstrap portal monorepo and ci"
```

### Task 3: Implement OAuth session, RBAC and audit

**Files:**
- Create: `apps/web/src/auth.ts`, `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- Create: `packages/config/src/auth-config.ts`
- Create: `packages/domain/src/auth/roles.ts`, `packages/domain/src/auth/permissions.ts`
- Create: `apps/api/src/plugins/auth.ts`, `apps/api/src/plugins/rbac.ts`
- Create: `packages/db/src/schema/auth.ts`, `packages/db/src/repositories/audit-repository.ts`
- Test: `packages/domain/src/auth/roles.test.ts`, `apps/api/src/plugins/auth.test.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- `authorize(request): Promise<Principal | AuthFailure>`.
- `requirePermission(principal, permission, resource): void`.
- `Principal = { subjectId: string; provider: "github"; email?: string; roles: Role[]; workspaceIds: string[] }`.
- `AuditRepository.append(event: AuditEvent): Promise<void>`.

- [ ] **Step 1: Write failing tests for role matrix and denied access**

```ts
it("allows a viewer to read but not approve a hypothesis", () => {
  const viewer = principalWithRole("viewer");
  expect(() => requirePermission(viewer, "hypothesis.read", workspaceResource())).not.toThrow();
  expect(() => requirePermission(viewer, "hypothesis.approve", workspaceResource())).toThrow("FORBIDDEN");
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm vitest run packages/domain/src/auth/roles.test.ts apps/api/src/plugins/auth.test.ts`
Expected: FAIL because auth modules do not exist.

- [ ] **Step 3: Implement OAuth callback and session security**

Use provider subject IDs from `AUTH_ALLOWED_GITHUB_IDS`, validate state/nonce/redirect URI, issue rotating HttpOnly Secure SameSite cookies, revoke sessions on logout, and write audit events for sign-in, denial, logout, role change and revoke.

- [ ] **Step 4: Run tests and browser smoke**

Run: `pnpm vitest run packages/domain/src/auth/roles.test.ts apps/api/src/plugins/auth.test.ts && pnpm playwright test tests/e2e/auth.spec.ts --grep "OAuth"`
Expected: unit tests PASS; E2E uses a local mocked OAuth provider and proves allowed/denied/revoked paths.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/auth.ts apps/web/src/app/api/auth packages/config/src/auth-config.ts packages/domain/src/auth apps/api/src/plugins/auth.ts apps/api/src/plugins/rbac.ts packages/db/src/schema/auth.ts packages/db/src/repositories/audit-repository.ts tests
git commit -m "feat: add oauth sessions rbac and audit"
```

### Task 4: Add PostgreSQL schema, migrations and fixtures

**Files:**
- Create: `packages/db/src/schema/core.ts`, `packages/db/src/schema/experiments.ts`, `packages/db/src/schema/metrics.ts`, `packages/db/src/schema/ingestion.ts`
- Create: `packages/db/drizzle.config.ts`, `packages/db/migrations/`
- Create: `packages/db/src/fixtures/park-skazka-fixture.ts`
- Test: `packages/db/src/schema/schema.test.ts`

**Interfaces:**
- `DbClient` exports typed repositories for `SourceAccount`, `Campaign`, `AdGroup`, `Ad`, `Creative`, `Hypothesis`, `Test`, `MetricObservation`, `Snapshot`, `SyncRun`, `MeasurementRun`, `Decision` and `AuditEvent`.
- Unique keys: `(source, accountExternalId, objectLevel, externalId)`, `(source, accountId, period, contentHash)`, `(testId, period, calculationVersion)`.

- [ ] **Step 1: Write migration/fixture tests**

```ts
it("rejects a decision for an unapproved test", async () => {
  await expect(decisionRepository.create({ testId: draftTest.id, outcome: "scale" })).rejects.toMatchObject({ code: "TEST_NOT_DECISION_DUE" });
});
```

- [ ] **Step 2: Run against an empty PostgreSQL container and confirm failure**

Run: `pnpm db:test -- packages/db/src/schema/schema.test.ts`
Expected: FAIL because tables and migrations do not exist.

- [ ] **Step 3: Implement schema and migration constraints**

Store source semantics, validity ranges, raw payload references, numerator/denominator, attribution context, quality/maturity statuses and immutable decision records. Add indexes for workspace/date/source/object filters.

- [ ] **Step 4: Run migrations and fixture tests**

Run: `pnpm db:migrate && pnpm db:test -- packages/db/src/schema/schema.test.ts`
Expected: PASS from an empty database; duplicate and orphan writes are rejected.

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat: add portal domain schema and migrations"
```

### Task 5: Build adapter SDK, snapshots and quality pipeline

**Files:**
- Create: `packages/adapters/src/contracts.ts`, `packages/adapters/src/errors.ts`
- Create: `apps/worker/src/jobs/sync-run.ts`, `apps/worker/src/jobs/normalize-snapshot.ts`, `apps/worker/src/jobs/quality-check.ts`
- Create: `packages/db/src/repositories/snapshot-repository.ts`, `packages/db/src/repositories/sync-run-repository.ts`
- Test: `packages/adapters/src/contracts.test.ts`, `apps/worker/src/jobs/sync-run.test.ts`

**Interfaces:**
- `ReadOnlyAdsAdapter.discoverCapabilities(account): Promise<Capabilities>`.
- `ReadOnlyAdsAdapter.listObjects(request): AsyncIterable<RawPage>`.
- `ReadOnlyAdsAdapter.getStats(request): AsyncIterable<RawPage>`.
- `SnapshotStore.put(input): Promise<SnapshotRef>`.
- `SyncRunService.execute(input): Promise<SyncRunResult>`.

- [ ] **Step 1: Write failing idempotency and unsupported-capability tests**

```ts
it("does not duplicate a snapshot on retry", async () => {
  const first = await execute(fixtureRequest);
  const second = await execute(fixtureRequest);
  expect(second.logicalFactSetId).toBe(first.logicalFactSetId);
  expect(await countSnapshots()).toBe(1);
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `pnpm vitest run packages/adapters/src/contracts.test.ts apps/worker/src/jobs/sync-run.test.ts`
Expected: FAIL because contracts and jobs do not exist.

- [ ] **Step 3: Implement the pipeline**

Persist raw bytes with SHA-256, schema version, extraction metadata and redacted warnings; validate period/currency/timezone; create `partial`/`needs_attention` on source failures; supersede changed snapshots; quarantine invalid rows.

- [ ] **Step 4: Run retry, partial and supersession tests**

Run: `pnpm vitest run packages/adapters/src/contracts.test.ts apps/worker/src/jobs/sync-run.test.ts`
Expected: PASS for idempotent retry, changed snapshot supersession and unsupported capability.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters apps/worker/src/jobs packages/db/src/repositories
git commit -m "feat: add read only ingestion and snapshot pipeline"
```

### Task 6: Implement Yandex Metrica adapter

**Files:**
- Create: `packages/adapters/src/yandex-metrica/client.ts`, `packages/adapters/src/yandex-metrica/adapter.ts`, `packages/adapters/src/yandex-metrica/mappers.ts`
- Create: `packages/adapters/src/yandex-metrica/fixtures/report.json`, `packages/adapters/src/yandex-metrica/fixtures/logs.json`
- Test: `packages/adapters/src/yandex-metrica/adapter.test.ts`

**Interfaces:**
- `YandexMetricaAdapter.getReport(request): Promise<RawPage>`.
- `YandexMetricaAdapter.getLogs(request): Promise<RawPage[]>`.
- Mapper returns visits, UTM, goals, revenue, sampling, sensitive-data and lag metadata.

- [ ] **Step 1: Write fixture tests**

Test `/stat/v1/data`, `/bytime`, goal dimensions, `sampled`, `contains_sensitive_data`, timezone and delayed-day policy.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run packages/adapters/src/yandex-metrica/adapter.test.ts`
Expected: FAIL because adapter is missing.

- [ ] **Step 3: Implement OAuth token injection and report mapping**

Use server-only token storage, bounded date windows, pagination, retry-after handling and explicit report/log selection. Never log Authorization headers or raw user-level data.

- [ ] **Step 4: Run adapter and normalization tests**

Run: `pnpm vitest run packages/adapters/src/yandex-metrica/adapter.test.ts apps/worker/src/jobs/normalize-snapshot.test.ts`
Expected: PASS with fixture totals preserved.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/yandex-metrica
git commit -m "feat: add yandex metrica read adapter"
```

### Task 7: Implement Avito Ads adapter

**Files:**
- Create: `packages/adapters/src/avito/client.ts`, `packages/adapters/src/avito/adapter.ts`, `packages/adapters/src/avito/mappers.ts`
- Create: `packages/adapters/src/avito/fixtures/campaign-statistics.json`
- Test: `packages/adapters/src/avito/adapter.test.ts`

**Interfaces:**
- `AvitoAdsAdapter.listCampaigns(request): AsyncIterable<RawPage>`.
- `AvitoAdsAdapter.listGroups(request): AsyncIterable<RawPage>`.
- `AvitoAdsAdapter.listCreatives(request): AsyncIterable<RawPage>`.
- `AvitoAdsAdapter.getStatistics(request): AsyncIterable<RawPage>`.

- [ ] **Step 1: Write OAuth, pagination, rate-limit and statistics fixture tests**

Assert that client credentials are read from server env only, `429/5xx` retries honor backoff, and statistics period/account metadata is preserved.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run packages/adapters/src/avito/adapter.test.ts`
Expected: FAIL because adapter is missing.

- [ ] **Step 3: Implement read-only client and mappers**

Use the official Ads API contract/SDK as reference, keep fields source-named in raw payload, map campaigns/groups/creatives/statistics into canonical facts and expose unsupported fields as warnings.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run packages/adapters/src/avito/adapter.test.ts`
Expected: PASS with no mutation method exported.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/avito
git commit -m "feat: add avito ads read adapter"
```

### Task 8: Implement VK Ads capability-gated adapter and file fallback

**Files:**
- Create: `packages/adapters/src/vk-ads/capabilities.ts`, `packages/adapters/src/vk-ads/adapter.ts`, `packages/adapters/src/vk-ads/mappers.ts`
- Create: `packages/adapters/src/vk-ads/file-import.ts`, `packages/adapters/src/vk-ads/fixtures/campaign-export.csv`
- Test: `packages/adapters/src/vk-ads/adapter.test.ts`, `packages/adapters/src/vk-ads/file-import.test.ts`

**Interfaces:**
- `VkAdsAdapter.discoverCapabilities(account): Promise<Capabilities>`.
- `VkAdsFileImport.parse(input: Buffer, metadata: ImportMetadata): Promise<NormalizedImport>`.

- [ ] **Step 1: Write tests for honest unsupported API and validated CSV/XLSX fallback**

Test that an unknown endpoint returns `unsupported`, while valid period/RUB/header/hash data imports and malformed files quarantine without facts.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run packages/adapters/src/vk-ads/adapter.test.ts packages/adapters/src/vk-ads/file-import.test.ts`
Expected: FAIL because capability adapter and importer are missing.

- [ ] **Step 3: Implement capability discovery and import validation**

Do not hardcode unverified API fields. Require account, period, currency and schema version; store imported file hash and source metadata; support idempotent repeat import.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run packages/adapters/src/vk-ads/adapter.test.ts packages/adapters/src/vk-ads/file-import.test.ts`
Expected: PASS; no mutation operations exist.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/vk-ads
git commit -m "feat: add vk ads capability gate and file fallback"
```

### Task 9: Implement Telegram Ads capability spike and destination rules

**Files:**
- Create: `packages/adapters/src/telegram-ads/capabilities.ts`, `packages/adapters/src/telegram-ads/adapter.ts`, `packages/adapters/src/telegram-ads/mappers.ts`
- Create: `packages/adapters/src/telegram-ads/fixtures/statistics.json`
- Test: `packages/adapters/src/telegram-ads/adapter.test.ts`

**Interfaces:**
- `TelegramAdsAdapter.discoverCapabilities(account): Promise<Capabilities>`.
- `validateTelegramDestination(url): { valid: boolean; kind: "channel" | "bot" | "external"; reason?: string }`.

- [ ] **Step 1: Write destination and capability tests**

Assert that channel/bot destinations are accepted, direct external site destinations are flagged for review, ad text length is validated, and unavailable read API becomes `manual_export_required`.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run packages/adapters/src/telegram-ads/adapter.test.ts`
Expected: FAIL because the capability module is missing.

- [ ] **Step 3: Implement read-only capability and mapper**

Preserve ad text, destination, target channels, CPM, budget, views, joins/bot starts, statuses and statistics period. Never infer website conversions from Telegram views without a separate tracked bridge.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run packages/adapters/src/telegram-ads/adapter.test.ts`
Expected: PASS with explicit unsupported/manual-export status where required.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/telegram-ads
git commit -m "feat: add telegram ads capability and destination rules"
```

### Task 10: Implement metric, attribution, maturity and decision engine

**Files:**
- Create: `packages/domain/src/metrics/definitions.ts`, `packages/domain/src/metrics/calculator.ts`, `packages/domain/src/metrics/attribution.ts`
- Create: `packages/domain/src/experiments/maturity.ts`, `packages/domain/src/experiments/decision.ts`
- Create: `apps/api/src/modules/measurements/measurement-service.ts`
- Test: `packages/domain/src/metrics/calculator.test.ts`, `packages/domain/src/experiments/decision.test.ts`

**Interfaces:**
- `calculateMetric(definition, observations): MetricResult`.
- `evaluateMaturity(gates, facts): MaturityResult`.
- `evaluateDecision(input): DecisionRecommendation`.
- `MeasurementService.run(testId, period): Promise<MeasurementRun>`.

- [ ] **Step 1: Write fixture tests with hand-calculated expectations**

Cover weighted CTR/CVR, CPC/CPA/ROAS, zero denominator, platform versus Metrica attribution, stale source, insufficient maturity, guardrail fail, invalid control and delivery bias.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run packages/domain/src/metrics/calculator.test.ts packages/domain/src/experiments/decision.test.ts`
Expected: FAIL because calculation modules are missing.

- [ ] **Step 3: Implement pure calculations and versioned measurement**

Persist formula version and context. Return `null` for zero denominator, never average rates blindly, and block `scale` unless all gates pass.

- [ ] **Step 4: Run focused and property tests**

Run: `pnpm vitest run packages/domain/src/metrics/calculator.test.ts packages/domain/src/experiments/decision.test.ts --coverage`
Expected: PASS with branch coverage for all decision gates.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/metrics packages/domain/src/experiments apps/api/src/modules/measurements
git commit -m "feat: add measurement and decision engine"
```

### Task 11: Implement hypothesis, test, rotation and creative-lineage API

**Files:**
- Create: `apps/api/src/modules/hypotheses/routes.ts`, `apps/api/src/modules/hypotheses/service.ts`, `apps/api/src/modules/hypotheses/validators.ts`
- Create: `apps/api/src/modules/experiments/routes.ts`, `apps/api/src/modules/experiments/service.ts`
- Create: `packages/domain/src/hypotheses/state-machine.ts`, `packages/domain/src/creative/lineage.ts`
- Test: `apps/api/src/modules/hypotheses/routes.test.ts`, `packages/domain/src/hypotheses/state-machine.test.ts`

**Interfaces:**
- `POST /api/v1/hypotheses` → `Hypothesis`.
- `POST /api/v1/hypotheses/:id/approve` → `Hypothesis`.
- `POST /api/v1/tests/:id/measure` → `MeasurementRun`.
- `POST /api/v1/tests/:id/decision` → `Decision`.
- `generateReplacementBatch(parentCreativeId): Promise<ReplacementBatch>` with exactly three variants.

- [ ] **Step 1: Write state and API tests**

Reject incomplete approval, illegal transitions, duplicate decision, missing one-variable control/challenger and replacement batches with non-unique variants.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run packages/domain/src/hypotheses/state-machine.test.ts apps/api/src/modules/hypotheses/routes.test.ts`
Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement validators, state machine, lineage and audit hooks**

Require owner, statement, learning question, variable, dates, primary/guardrails, baseline/control, sample gates and stop rules before approval. Keep creative drafts local and unpublishable.

- [ ] **Step 4: Run focused API tests**

Run: `pnpm vitest run packages/domain/src/hypotheses/state-machine.test.ts apps/api/src/modules/hypotheses/routes.test.ts`
Expected: PASS with audit events for every transition.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/hypotheses apps/api/src/modules/experiments packages/domain/src/hypotheses packages/domain/src/creative
git commit -m "feat: add hypothesis experiment and creative lineage api"
```

### Task 12: Build summary, explorer, hypotheses and creative UI

**Files:**
- Create: `apps/web/src/app/(portal)/dashboard/page.tsx`
- Create: `apps/web/src/app/(portal)/campaigns/page.tsx`
- Create: `apps/web/src/app/(portal)/hypotheses/page.tsx`, `apps/web/src/app/(portal)/hypotheses/[id]/page.tsx`
- Create: `apps/web/src/app/(portal)/creative-lab/page.tsx`, `apps/web/src/app/(portal)/rotations/page.tsx`
- Create: `apps/web/src/components/filters/global-filter-bar.tsx`, `apps/web/src/components/quality/quality-badge.tsx`
- Test: `tests/e2e/portal-flow.spec.ts`, `apps/web/src/components/filters/global-filter-bar.test.tsx`

**Interfaces:**
- `GET /api/v1/summary` accepts `date_from`, `date_to`, `timezone`, `filters`, `attribution_model`, `comparison`.
- `GET /api/v1/campaigns/:id/tree` returns hierarchy and versioned settings.
- `GET /api/v1/hypotheses` returns status, maturity, quality and next action.

- [ ] **Step 1: Write component and E2E tests**

Test URL-preserved filters, inclusive custom range, quality badges, role-aware actions, summary-to-hypothesis navigation and no token exposure in HTML/network responses.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run apps/web/src/components/filters/global-filter-bar.test.tsx && pnpm playwright test tests/e2e/portal-flow.spec.ts`
Expected: FAIL because pages/components are missing.

- [ ] **Step 3: Implement UI slices in navigation order**

Build app shell, dashboard, explorer, hypothesis board/detail, rotations, Creative Lab, data quality and integrations. Use server-side API calls, pagination, virtualized tables, URL state and explicit source/attribution/freshness labels.

- [ ] **Step 4: Run focused browser tests**

Run: `pnpm vitest run apps/web/src/components/filters/global-filter-bar.test.tsx && pnpm playwright test tests/e2e/portal-flow.spec.ts`
Expected: PASS for owner/analyst/reviewer/viewer flows against fixtures.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src tests/e2e/portal-flow.spec.ts
git commit -m "feat: add hypothesis portal dashboard and workflows"
```

### Task 13: Add operations, observability and security hardening

**Files:**
- Create: `apps/api/src/health/routes.ts`, `apps/worker/src/observability/metrics.ts`
- Create: `packages/config/src/redaction.ts`, `packages/config/src/rate-limit.ts`
- Create: `ops/docker/`, `ops/runbooks/backup-restore.md`, `ops/runbooks/revoke-access.md`
- Modify: `.github/workflows/ci.yml`
- Test: `tests/security/secret-scan.test.ts`, `tests/ops/backup-restore.test.ts`

**Interfaces:**
- `GET /health/live`, `GET /health/ready`.
- `redact(value): SafeLogValue`.
- `recordSyncMetrics(result): void`.
- `restoreBackup(backupRef, targetDb): Promise<RestoreReport>`.

- [ ] **Step 1: Write failure-mode tests**

Cover redaction of Authorization/cookie/password fields, rate limits, dead-letter replay, stale-source alert and backup restore to empty DB.

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm vitest run tests/security/secret-scan.test.ts tests/ops/backup-restore.test.ts`
Expected: FAIL because operational modules are missing.

- [ ] **Step 3: Implement observability and controls**

Add structured redacted logs, request/run correlation, retry/dead-letter policy, health checks, alerts, dependency scanning, CodeQL, push protection, backup encryption and restore runbook.

- [ ] **Step 4: Run focused security checks**

Run: `pnpm test tests/security/secret-scan.test.ts tests/ops/backup-restore.test.ts && pnpm audit --audit-level high`
Expected: PASS; high-severity dependency findings are zero or documented with an accepted exception.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/health apps/worker/src/observability packages/config/src ops .github/workflows/ci.yml tests/security tests/ops
git commit -m "chore: harden operations observability and secret handling"
```

### Task 14: Run pilot, reconcile sources and publish release

**Files:**
- Create: `ops/runbooks/pilot.md`, `ops/runbooks/reconciliation.md`, `CHANGELOG.md`
- Create: `tests/e2e/pilot-read-only.spec.ts`
- Modify: `README.md`, `docs/INTEGRATION-MATRIX.md`, `docs/ROADMAP.md`

**Interfaces:**
- `runPilot({ sourceAccounts, period, dryRun: true }): Promise<PilotReport>`.
- `reconcile({ source, period, tolerance }): Promise<ReconciliationReport>`.

- [ ] **Step 1: Write pilot acceptance tests**

Require OAuth login, source health, one imported period, summary-to-snapshot trace, one hypothesis decision, no mutations, no secrets and explainable warnings.

- [ ] **Step 2: Run and confirm the pilot is initially blocked**

Run: `pnpm playwright test tests/e2e/pilot-read-only.spec.ts`
Expected: FAIL until real OAuth/provider fixtures and approved source capability fixtures are configured outside Git.

- [ ] **Step 3: Execute staging pilot**

Use separate staging OAuth client and source credentials from secret manager; import a limited period, reconcile platform totals and Metrica goals, document unmatched rows and verify that Telegram destination policy is satisfied.

- [ ] **Step 4: Run release gates**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm playwright test && pnpm audit --audit-level high`
Expected: PASS; backup restore and secret scan evidence attached to the release checklist.

- [ ] **Step 5: Commit and tag**

```bash
git add ops/runbooks CHANGELOG.md README.md docs tests/e2e/pilot-read-only.spec.ts
git commit -m "chore: document pilot and release gates"
git tag v0.1.0
```

## Self-review against the specification

- Summary, filters, date range: Task 12.
- Campaign/group/ad/creative/settings hierarchy: Tasks 4, 5 and 12.
- Hypothesis lifecycle, metrics, maturity, guardrails and decisions: Tasks 10–11.
- Creative hooks, copy, visual, CTA, offer, landing, rotations and A/B/C batch: Tasks 4, 11 and 12.
- VK Ads, Yandex Metrica, Avito Ads, Telegram Ads: Tasks 6–9.
- Raw/normalized/mart/quality layers and idempotency: Task 5.
- OAuth, RBAC, audit, public-repository security: Tasks 1–3 and 13.
- CI, E2E, observability, backup/restore and pilot: Tasks 2, 13 and 14.

