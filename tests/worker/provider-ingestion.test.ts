import { describe, expect, it } from "vitest";
import {
  canonicalizeBatch,
  collectProviderBatch,
  hashNormalizedBatch,
  normalizeProviderRow,
  planProviderSnapshot,
  toD1WriteStatements,
  validateNormalizedBatch,
  type NormalizedProviderBatch,
} from "@portal/worker/jobs/provider-ingestion";

function batch(overrides: Partial<NormalizedProviderBatch> = {}): NormalizedProviderBatch {
  return {
    source: "vk_ads",
    accountId: "account-1",
    from: "2026-08-12",
    to: "2026-08-12",
    schemaVersion: "vk.v1",
    extractionMethod: "file_import",
    rows: [
      {
        source: "vk_ads",
        objectLevel: "campaign",
        externalId: "campaign-1",
        name: "Summer",
        metricValues: { impressions: 100 },
      },
    ],
    ...overrides,
  };
}

describe("provider snapshot ingestion boundary", () => {
  it("accepts all supported provider sources and normalizes provider lineage aliases", () => {
    expect(normalizeProviderRow("vk_ads", {
      objectLevel: "ad_group",
      externalId: "group-1",
      name: "Group",
      campaignExternalId: "campaign-1",
    })).toMatchObject({ source: "vk_ads", campaignExternalId: "campaign-1" });

    for (const source of ["vk_ads", "yandex_metrica", "avito_ads", "telegram_ads"] as const) {
      expect(() => validateNormalizedBatch(batch({ source, rows: [{
        source,
        objectLevel: "campaign",
        externalId: `${source}-campaign`,
        name: source,
      }] }))).not.toThrow();
    }
  });

  it("hashes canonically regardless of row order and skips duplicate snapshots", () => {
    const first = batch({ rows: [
      { source: "vk_ads", objectLevel: "ad", externalId: "ad-2", name: "B" },
      { source: "vk_ads", objectLevel: "campaign", externalId: "campaign-1", name: "A" },
    ] });
    const second = batch({ rows: [...first.rows].reverse() });
    expect(canonicalizeBatch(first)).toBe(canonicalizeBatch(second));
    expect(hashNormalizedBatch(first)).toBe(hashNormalizedBatch(second));
    expect(planProviderSnapshot(first, new Set([hashNormalizedBatch(first)])).action).toBe("skip_duplicate");
  });

  it("rejects secrets, duplicate identities, and rows outside requested period", () => {
    expect(() => normalizeProviderRow("vk_ads", {
      objectLevel: "campaign", externalId: "campaign-1", name: "ok", apiToken: "hidden",
    })).toThrow("SECRET_FIELD");
    expect(() => validateNormalizedBatch(batch({ rows: [
      { source: "vk_ads", objectLevel: "campaign", externalId: "same", name: "A" },
      { source: "vk_ads", objectLevel: "campaign", externalId: "same", name: "B" },
    ] }))).toThrow("DUPLICATE_OBJECT");
    expect(() => validateNormalizedBatch(batch({ rows: [{
      source: "vk_ads", objectLevel: "campaign", externalId: "late", name: "Late", date: "2026-08-13",
    }] }))).toThrow("ROW_OUTSIDE_PERIOD");
  });

  it("creates parameterized D1 statements without raw provider payloads", () => {
    const plan = planProviderSnapshot(batch({ rows: [{
      source: "vk_ads",
      objectLevel: "creative",
      externalId: "creative-1",
      name: "Hook",
      parentExternalId: "ad-1",
      contentHash: "a".repeat(64),
      metricValues: { clicks: 4 },
    }] }));
    const statements = toD1WriteStatements(plan, "2026-08-13T10:00:00.000Z");
    expect(statements).toHaveLength(2);
    expect(statements.every((statement) => statement.sql.includes("?"))).toBe(true);
    expect(statements.map((statement) => statement.sql).join(" ")).not.toContain("Hook");
    expect(statements[1]?.bindings).toContain("creative-1");
    expect(toD1WriteStatements({ ...plan, action: "skip_duplicate" })).toEqual([]);
  });

  it("collects list and stats pages into one metric-enriched normalized row", async () => {
    const adapter = {
      source: "yandex_metrica" as const,
      discoverCapabilities: async () => ({
        source: "yandex_metrica" as const,
        supported: true,
        objectLevels: ["campaign"] as const,
        metrics: ["sessions"] as const,
        extractionMethod: "api" as const,
      }),
      async *listObjects() {
        yield { page: 1, hasNextPage: false, rows: [{
          objectLevel: "campaign", externalId: "campaign-1", name: "Yandex",
        }] };
      },
      async *getStats() {
        yield { page: 1, hasNextPage: false, rows: [{
          objectLevel: "campaign", externalId: "campaign-1", name: "Yandex", metrics: { sessions: 42 },
        }] };
      },
    };
    const result = await collectProviderBatch({
      adapter,
      accountId: "counter-1",
      from: "2026-08-12",
      to: "2026-08-12",
      timezone: "Europe/Moscow",
      schemaVersion: "yandex.v1",
    });
    expect(result.rows).toEqual([expect.objectContaining({ externalId: "campaign-1", metricValues: { sessions: 42 } })]);
  });
});

