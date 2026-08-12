export type DatabaseHealth = {
  driver: "postgresql";
  status: "not_configured" | "ready";
};

export type { AuditEvent, AuditEventInput, SessionRecord } from "./schema/auth.js";
export type { AuditRepository } from "./repositories/audit-repository.js";
export { InMemoryAuditRepository } from "./repositories/audit-repository.js";
export { InMemoryPortalRepository } from "./repositories/portal-repository.js";
export { InMemorySnapshotRepository } from "./repositories/snapshot-repository.js";
export { InMemorySyncRunRepository } from "./repositories/sync-run-repository.js";
export { FixturePortalReadRepository } from "./repositories/read-repository.js";
export type { PortalReadRepository } from "./repositories/read-repository.js";
export { createParkSkazkaFixture } from "./fixtures/park-skazka-fixture.js";
export * from "./schema/core.js";
export * from "./schema/experiments.js";
export * from "./schema/metrics.js";
export * from "./schema/ingestion.js";

export function databaseHealth(databaseUrl: string | undefined): DatabaseHealth {
  return {
    driver: "postgresql",
    status: databaseUrl ? "ready" : "not_configured",
  };
}

