import { describe, expect, it } from "vitest";
import { createApiReadService, createApiReadServiceFromEnv } from "@portal/api/read-service";

describe("API read service factory", () => {
  it("defaults to fixture backend without requiring a database URL", async () => {
    const service = createApiReadService({});
    const response = await service.handle(
      new Request("http://portal.test/api/summary?from=2026-08-12&to=2026-08-12"),
    );

    expect(service.backend).toBe("fixture");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ summary: { source: "vk_ads" } });
  });

  it("rejects a postgres backend without an explicitly injected executor", () => {
    expect(() => createApiReadService({ backend: "postgres" })).toThrow(
      "POSTGRES_READ_EXECUTOR_REQUIRED",
    );
  });

  it("preserves the injected postgres executor behind a read-only query boundary", async () => {
    let receivedSql = "";
    const service = createApiReadService({
      backend: "postgres",
      postgresExecutor: {
        async query(sql) {
          receivedSql = sql;
          return [];
        },
      },
    });

    expect(service.backend).toBe("postgres");
    expect(await service.readRows({
      workspaceId: "workspace-1",
      from: "2026-08-12",
      to: "2026-08-12",
    })).toEqual([]);
    expect(receivedSql.toLowerCase()).toContain("select");
    expect(service).not.toHaveProperty("create");
    expect(service).not.toHaveProperty("update");
    expect(service).not.toHaveProperty("delete");
  });

  it("fails closed for an unknown backend", () => {
    expect(() => createApiReadService({ backend: "mysql" as never })).toThrow(
      "INVALID_READ_BACKEND",
    );
  });

  it("keeps fixture handler GET-only", async () => {
    const response = await createApiReadService({ backend: "fixture" }).handle(
      new Request("http://portal.test/api/summary", { method: "POST" }),
    );

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: "READ_ONLY_ROUTE" });
  });

  it("selects the backend from the validated server environment", () => {
    const service = createApiReadServiceFromEnv({ portalReadBackend: "fixture" });

    expect(service.backend).toBe("fixture");
  });
});

