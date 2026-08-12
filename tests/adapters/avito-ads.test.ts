import { describe, expect, it } from "vitest";
import { createAvitoAdsAdapter } from "@portal/adapters/avito-ads/adapter";
import { avitoFixtureExport } from "@portal/adapters/avito-ads/fixtures";
import { mapAvitoCreatives } from "@portal/adapters/avito-ads/mapper";

describe("Avito Ads native creative adapter", () => {
  it("maps approved native creative metadata and lineage", () => {
    const rows = mapAvitoCreatives(avitoFixtureExport);

    expect(rows).toEqual([
      expect.objectContaining({
        source: "avito_ads",
        objectLevel: "creative",
        externalId: "avito-creative-family",
        campaignExternalId: "avito-campaign-summer",
        adExternalId: "avito-ad-family",
        aspectRatio: "4:5",
        width: 600,
        height: 750,
        moderationStatus: "approved",
        utm: expect.objectContaining({ source: "avito", medium: "native" }),
      }),
    ]);
  });

  it("rejects an invalid native creative before it becomes a valid row", () => {
    expect(() =>
      mapAvitoCreatives([
        {
          ...avitoFixtureExport[0],
          width: 1200,
          height: 628,
          fileBytes: 2 * 1024 * 1024 + 1,
          moderationStatus: "rejected",
        },
      ]),
    ).toThrow("INVALID_CREATIVE");
  });

  it("exposes file-import capability and no mutation methods", async () => {
    const adapter = createAvitoAdsAdapter({
      accountId: "avito-account-fixture",
      exportRows: avitoFixtureExport,
    });
    await expect(adapter.discoverCapabilities()).resolves.toMatchObject({
      source: "avito_ads",
      supported: true,
      extractionMethod: "file_import",
    });

    expect(Object.keys(adapter)).not.toEqual(
      expect.arrayContaining(["createCreative", "publishCreative", "updateCampaign", "deleteAd"]),
    );
  });

  it("validates period and timezone for native creative reads", async () => {
    const adapter = createAvitoAdsAdapter({
      accountId: "avito-account-fixture",
      exportRows: avitoFixtureExport,
    });

    await expect(
      adapter
        .listObjects({
          accountId: "avito-account-fixture",
          from: "2026-08-13",
          to: "2026-08-12",
          timezone: "Europe/Moscow",
        })
        .next(),
    ).rejects.toThrow("INVALID_PERIOD");
  });
});

