import { describe, expect, it } from "vitest";
import { createTelegramAdsAdapter } from "@portal/adapters/telegram-ads/adapter";
import { telegramFixtureExport } from "@portal/adapters/telegram-ads/fixtures";
import { mapTelegramAds } from "@portal/adapters/telegram-ads/mapper";

describe("Telegram Ads read-only adapter", () => {
  it("maps channel, campaign, message and creative lineage", () => {
    const rows = mapTelegramAds(telegramFixtureExport);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectLevel: "campaign",
          externalId: "tg-campaign-summer",
          channelExternalId: "channel-parkskazka",
        }),
        expect.objectContaining({
          objectLevel: "ad",
          externalId: "tg-message-family",
          campaignExternalId: "tg-campaign-summer",
          messageText: expect.stringContaining("Парк Сказка"),
          mediaType: "image",
          destinationUrl: expect.stringContaining("parkskazka.com"),
        }),
        expect.objectContaining({
          objectLevel: "creative",
          externalId: "tg-creative-family",
          hook: "Семейный выходной",
          cta: "Выбрать дату",
        }),
      ]),
    );
  });

  it("preserves UTM and targeting context in stats rows", async () => {
    const adapter = createTelegramAdsAdapter({
      accountId: "tg-account-fixture",
      exportRows: telegramFixtureExport,
    });
    const page = await adapter
      .getStats({
        accountId: "tg-account-fixture",
        from: "2026-08-12",
        to: "2026-08-12",
        timezone: "Europe/Moscow",
        metricKeys: ["impressions", "clicks", "spend"],
      })
      .next();

    expect(page.value?.rows[0]).toEqual(
      expect.objectContaining({
        currency: "RUB",
        spend: 7800,
        targeting: expect.objectContaining({ language: "ru", interests: ["family", "leisure"] }),
        utm: expect.objectContaining({ source: "telegram", medium: "sponsored" }),
      }),
    );
  });

  it("rejects invalid channel/message/date inputs and exposes no mutations", async () => {
    const adapter = createTelegramAdsAdapter({
      accountId: "tg-account-fixture",
      exportRows: telegramFixtureExport,
    });

    await expect(
      adapter
        .listObjects({
          accountId: "tg-account-fixture",
          from: "2026-08-13",
          to: "2026-08-12",
          timezone: "Europe/Moscow",
        })
        .next(),
    ).rejects.toThrow("INVALID_PERIOD");

    expect(Object.keys(adapter)).not.toEqual(
      expect.arrayContaining(["createCampaign", "publishMessage", "updateChannel", "deleteCreative"]),
    );
  });

  it("reports unsupported capability when Telegram export is unavailable", async () => {
    const adapter = createTelegramAdsAdapter({
      accountId: "tg-account-fixture",
      exportRows: null,
    });

    await expect(adapter.discoverCapabilities()).resolves.toMatchObject({
      source: "telegram_ads",
      supported: false,
      reason: "provider_unavailable",
    });
  });
});

