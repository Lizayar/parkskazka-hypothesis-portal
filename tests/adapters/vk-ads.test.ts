import { describe, expect, it } from "vitest";
import { createVkAdsAdapter } from "@portal/adapters/vk-ads/adapter";
import { mapVkExport } from "@portal/adapters/vk-ads/mapper";
import { vkFixtureExport } from "@portal/adapters/vk-ads/fixtures";

describe("VK Ads export/file-ingestion adapter", () => {
  it("maps campaign, ad group, ad and creative lineage", () => {
    const rows = mapVkExport(vkFixtureExport);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectLevel: "campaign",
          externalId: "vk-campaign-summer",
          name: "Summer Park Visit",
        }),
        expect.objectContaining({
          objectLevel: "ad_group",
          externalId: "vk-ad-group-families",
          parentExternalId: "vk-campaign-summer",
        }),
        expect.objectContaining({
          objectLevel: "ad",
          externalId: "vk-ad-control",
          parentExternalId: "vk-ad-group-families",
        }),
        expect.objectContaining({
          objectLevel: "creative",
          externalId: "vk-creative-control",
          hook: "Отдых рядом с городом",
          offer: "Билет на семейный день",
          cta: "Узнать программу",
        }),
      ]),
    );
  });

  it("keeps RUB spend and UTM lineage in stats rows", async () => {
    const adapter = createVkAdsAdapter({
      accountId: "vk-account-fixture",
      currency: "RUB",
      exportRows: vkFixtureExport,
    });
    const page = await adapter
      .getStats({
        accountId: "vk-account-fixture",
        from: "2026-08-12",
        to: "2026-08-12",
        timezone: "Europe/Moscow",
        metricKeys: ["spend", "clicks"],
      })
      .next();

    expect(page.value?.rows[0]).toEqual(
      expect.objectContaining({
        currency: "RUB",
        spend: 12500,
        utm: expect.objectContaining({
          source: "vk",
          medium: "cpc",
          campaign: "summer-park",
        }),
      }),
    );
  });

  it("rejects invalid currency and period without mutation surface", async () => {
    const adapter = createVkAdsAdapter({
      accountId: "vk-account-fixture",
      currency: "EUR",
      exportRows: vkFixtureExport,
    });

    await expect(
      adapter
        .listObjects({
          accountId: "vk-account-fixture",
          from: "2026-08-13",
          to: "2026-08-12",
          timezone: "Europe/Moscow",
        })
        .next(),
    ).rejects.toThrow("INVALID_PERIOD");

    await expect(
      adapter
        .getStats({
          accountId: "vk-account-fixture",
          from: "2026-08-12",
          to: "2026-08-12",
          timezone: "Europe/Moscow",
          metricKeys: ["spend"],
        })
        .next(),
    ).rejects.toThrow("INVALID_CURRENCY");

    expect(Object.keys(adapter)).not.toEqual(
      expect.arrayContaining(["createCampaign", "updateAd", "publishCreative", "deleteObject"]),
    );
  });

  it("reports file-import capability when export is available", async () => {
    const adapter = createVkAdsAdapter({
      accountId: "vk-account-fixture",
      currency: "RUB",
      exportRows: vkFixtureExport,
    });

    await expect(adapter.discoverCapabilities()).resolves.toMatchObject({
      source: "vk_ads",
      supported: true,
      extractionMethod: "file_import",
    });
  });
});

