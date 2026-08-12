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

  it("maps injected postgres rows into hypotheses, explorer and metrics status", async () => {
    const service = createApiReadService({
      backend: "postgres",
      postgresExecutor: {
        async query<Row extends Record<string, unknown>>() {
          return [{
            workspace_id: "workspace-1",
            workspace_slug: "parkskazka",
            workspace_name: "Park Skazka",
            timezone: "Europe/Moscow",
            campaign_id: "campaign-1",
            campaign_name: "Summer",
            source: "vk_ads",
            ad_group_id: "group-1",
            ad_group_name: "Families",
            ad_id: "ad-1",
            ad_name: "Control A",
            creative_id: "creative-1",
            creative_name: "Family weekend",
            hypothesis_id: "hypothesis-1",
            hypothesis_title: "Family hook",
            hypothesis_status: "running",
            hypothesis_owner_subject_id: "github|owner",
            primary_metric: "cost_per_lead",
            starts_on: "2026-08-12",
            ends_on: "2026-08-19",
            decision_outcome: "iterate",
          }] as unknown as Row[];
        },
      },
    });

    const models = await service.readModels({
      workspaceId: "workspace-1",
      from: "2026-08-12",
      to: "2026-08-19",
    });

    expect(models.hypotheses).toMatchObject([
      expect.objectContaining({ id: "hypothesis-1", decision: "iterate" }),
    ]);
    expect(models.tree[0]?.adGroups[0]?.ads[0]?.creatives[0]).toEqual({
      creativeId: "creative-1",
      creativeName: "Family weekend",
    });
    expect(models.metrics.status).toBe("not_loaded");
  });

  it("does not silently use fixture models for the fixture readModels path", async () => {
    await expect(createApiReadService({ backend: "fixture" }).readModels({
      workspaceId: "workspace-1",
      from: "2026-08-12",
      to: "2026-08-19",
    })).rejects.toThrow("READ_MODELS_POSTGRES_ONLY");
  });
});

