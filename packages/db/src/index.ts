export type DatabaseHealth = {
  driver: "postgresql";
  status: "not_configured" | "ready";
};

export type { AuditEvent, AuditEventInput, SessionRecord } from "./schema/auth.js";
export type { AuditRepository } from "./repositories/audit-repository.js";
export { InMemoryAuditRepository } from "./repositories/audit-repository.js";

export function databaseHealth(databaseUrl: string | undefined): DatabaseHealth {
  return {
    driver: "postgresql",
    status: databaseUrl ? "ready" : "not_configured",
  };
}

