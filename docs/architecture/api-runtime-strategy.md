# API runtime strategy

## Selected boundary

The current local/CI API entry uses an explicit JavaScript **JS bridge** at
`apps/api/src/server.mjs`. It is intentionally free of TypeScript path aliases
such as `@portal/*`, because plain Node cannot resolve the repository's
`tsconfig` aliases without a loader or bundler.

The bridge owns only HTTP composition and the fixture read contract used by the
local smoke profile. It never reads credentials, browser storage, or raw
database URLs. The typed `createApiReadService` and PostgreSQL mapper remain
separately testable package boundaries.

## Production gate

`pnpm api:runtime:check` validates that the JS entry has no unresolved
`@portal/*` imports or secret-bearing environment names. CI should run this
check before a deployment artifact is accepted.

## Upgrade path

When a production bundler or explicit TypeScript loader is selected, it must be
introduced as a separate reviewed change. The new entry must preserve GET-only
routes, explicit PostgreSQL errors, and the no-secrets boundary. Until then,
the bridge is the reproducible runtime strategy and PostgreSQL HTTP mapping
remains explicit `501 POSTGRES_READ_ROUTE_NOT_MAPPED` rather than a silent
fixture fallback.

