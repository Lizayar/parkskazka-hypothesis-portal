import { describe, expect, it } from "vitest";
import {
  createPostgresReadRepository,
  type SqlExecutor,
} from "@portal/db/repositories/postgres-read-repository";

describe("postgres portal read repository", () => {
  it("maps parameterized rows into the portal read model without write methods", async () => {
    const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
    const executor: SqlExecutor = {
      async query<Row extends Record<string, unknown>>(sql: string, params: readonly unknown[]) {
        calls.push({ sql, params });
        return [
          {
            workspace_id: "workspace-1",
            workspace_slug: "parkskazka",
            workspace_name: "Park Skazka",
            timezone: "Europe/Moscow",
            campaign_id: "campaign-1",
            campaign_name: "Summer",
            source: "vk_ads",
            hypothesis_id: "hypothesis-1",
            hypothesis_title: "Family hook",
            hypothesis_status: "running",
            starts_on: "2026-08-12",
            ends_on: "2026-08-19",
            decision_outcome: "inconclusive",
            ad_group_id: "group-1",
            ad_group_name: "Families",
            ad_id: "ad-1",
            ad_name: "Control A",
            creative_id: "creative-1",
            creative_name: "Family weekend",
            hypothesis_owner_subject_id: "github|owner",
            primary_metric: "cost_per_lead",
          },
        ] as unknown as Row[];
      },
    };

    const repository = createPostgresReadRepository(executor);
    const rows = await repository.getPortalReadRows({
      workspaceId: "workspace-1",
      from: "2026-08-12",
      to: "2026-08-19",
      source: "vk_ads",
    });

    expect(rows[0]).toMatchObject({
      workspaceId: "workspace-1",
      campaignId: "campaign-1",
      hypothesisId: "hypothesis-1",
      source: "vk_ads",
      adGroupId: "group-1",
      adId: "ad-1",
      creativeId: "creative-1",
      hypothesisOwnerSubjectId: "github|owner",
      primaryMetric: "cost_per_lead",
    });
    expect(calls[0]?.sql.toLowerCase()).toContain("select");
    expect(calls[0]?.sql).toContain("workspace_id");
    expect(calls[0]?.sql).toContain("ad_group");
    expect(calls[0]?.sql).toContain("creative");
    expect(calls[0]?.sql).toContain("owner_subject_id");
    expect(calls[0]?.sql).toContain("primary_metric");
    expect(calls[0]?.params).toEqual([
      "workspace-1",
      "2026-08-12",
      "2026-08-19",
      "vk_ads",
    ]);
    expect(repository).not.toHaveProperty("create");
    expect(repository).not.toHaveProperty("update");
    expect(repository).not.toHaveProperty("delete");
  });

  it("normalizes date values returned by postgres drivers", async () => {
    const executor: SqlExecutor = {
      async query<Row extends Record<string, unknown>>() {
        return [{
          workspace_id: "workspace-1",
          workspace_slug: "parkskazka",
          workspace_name: "Park Skazka",
          timezone: "Europe/Moscow",
          campaign_id: "campaign-1",
          campaign_name: "Summer",
          source: "vk_ads",
          starts_on: new Date("2026-08-12T00:00:00.000Z"),
          ends_on: new Date("2026-08-19T00:00:00.000Z"),
        }] as unknown as Row[];
      },
    };

    const [row] = await createPostgresReadRepository(executor).getPortalReadRows({
      workspaceId: "workspace-1",
      from: "2026-08-12",
      to: "2026-08-19",
    });

    expect(row.startsOn).toBe("2026-08-12");
    expect(row.endsOn).toBe("2026-08-19");
  });

  it("keeps source optional while preserving the date and workspace parameters", async () => {
    const executor: SqlExecutor = {
      async query(_sql, params) {
        expect(params).toEqual(["workspace-1", "2026-08-12", "2026-08-19", null]);
        return [];
      },
    };

    const rows = await createPostgresReadRepository(executor).getPortalReadRows({
      workspaceId: "workspace-1",
      from: "2026-08-12",
      to: "2026-08-19",
    });

    expect(rows).toEqual([]);
  });
});

