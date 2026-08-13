import { describe, expect, it } from "vitest";
import { createReadOnlyExportIntake } from "@portal/worker/jobs/export-intake";

const intake = createReadOnlyExportIntake("vk_ads", (row: { campaignId: string; campaignName: string; impressions: number; apiToken?: string }) => ({
  objectLevel: "campaign",
  externalId: row.campaignId,
  name: row.campaignName,
  impressions: row.impressions,
}));

describe("read-only export intake", () => {
  it("accepts a mapped JSON export and returns a validated normalized batch", () => {
    const batch = intake.acceptJson(JSON.stringify({
      source: "vk_ads",
      accountId: "vk-account",
      from: "2026-08-12",
      to: "2026-08-12",
      schemaVersion: "vk.export.v1",
      extractionMethod: "file_import",
      rows: [{ campaignId: "campaign-1", campaignName: "Summer", impressions: 42 }],
    }));
    expect(batch).toMatchObject({ source: "vk_ads", accountId: "vk-account", rows: [{ externalId: "campaign-1", metricValues: { impressions: 42 } }] });
  });

  it("fails closed on malformed JSON, source mismatch, secret fields and oversized input", () => {
    expect(() => intake.acceptJson("{" )).toThrow("INVALID_EXPORT_JSON");
    expect(() => intake.accept({ source: "telegram_ads", accountId: "a", from: "2026-08-12", to: "2026-08-12", schemaVersion: "v1", extractionMethod: "file_import", rows: [] })).toThrow("SOURCE_MISMATCH");
    expect(() => intake.accept({ source: "vk_ads", accountId: "a", from: "2026-08-12", to: "2026-08-12", schemaVersion: "v1", extractionMethod: "file_import", rows: [{ campaignId: "c", campaignName: "x", impressions: 1, apiToken: "secret" }] })).toThrow("SECRET_FIELD");
    expect(() => intake.acceptJson(JSON.stringify({ payload: "x".repeat(5 * 1024 * 1024) }))).toThrow("EXPORT_JSON_TOO_LARGE");
  });
});

