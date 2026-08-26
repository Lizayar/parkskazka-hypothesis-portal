import { describe, expect, it } from "vitest";
import { createAvitoAdsAdapter } from "@portal/adapters/avito-ads/adapter";
import { avitoFixtureExport } from "@portal/adapters/avito-ads/fixtures";
import { createTelegramAdsAdapter } from "@portal/adapters/telegram-ads/adapter";
import { telegramFixtureExport } from "@portal/adapters/telegram-ads/fixtures";
import { createVkAdsAdapter } from "@portal/adapters/vk-ads/adapter";
import { vkFixtureExport } from "@portal/adapters/vk-ads/fixtures";
import { createYandexMetricaAdapter } from "@portal/adapters/yandex-metrica/adapter";
import { yandexFixtureReport } from "@portal/adapters/yandex-metrica/fixtures";
import { collectProviderBatch } from "@portal/worker/jobs/provider-ingestion";
import { reconcileNormalizedBatch } from "@portal/worker/jobs/reconciliation";

async function collect(adapter: Parameters<typeof collectProviderBatch>[0]["adapter"], accountId: string, schemaVersion: string) {
  return collectProviderBatch({ adapter, accountId, from: "2026-08-12", to: "2026-08-12", timezone: "Europe/Moscow", schemaVersion });
}

describe("read-only export reconciliation", () => {
  it("matches VK Ads normalized totals within tolerance", async () => {
    const batch = await collect(createVkAdsAdapter({ accountId: "vk-account", currency: "RUB", exportRows: vkFixtureExport }), "vk-account", "vk.v1");
    const result = reconcileNormalizedBatch(batch, { spend: 12500, impressions: 42000, clicks: 980 });
    expect(result.status).toBe("matched");
    expect(result.metrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ metric: "spend", observed: 12500, status: "matched" }),
      expect.objectContaining({ metric: "clicks", observed: 980, status: "matched" }),
    ]));
  });

  it("marks Yandex missing metric and Telegram mismatch explicitly", async () => {
    const yandex = await collect(createYandexMetricaAdapter({ counterId: "counter-fixture", timezone: "Europe/Moscow", report: yandexFixtureReport }), "counter-fixture", "yandex.v1");
    expect(reconcileNormalizedBatch(yandex, { sessions: 1200, leads: 48 }).status).toBe("partial");

    const telegram = await collect(createTelegramAdsAdapter({ accountId: "tg-account", exportRows: telegramFixtureExport }), "tg-account", "telegram.v1");
    const result = reconcileNormalizedBatch(telegram, { spend: 7000, impressions: 28000, clicks: 640 });
    expect(result.status).toBe("mismatch");
    expect(result.metrics).toEqual(expect.arrayContaining([expect.objectContaining({ metric: "spend", observed: 7800, status: "mismatch" })]));
  });

  it("marks Avito creative-only export as not comparable without inventing metrics", async () => {
    const batch = await collect(createAvitoAdsAdapter({ accountId: "avito-account", exportRows: avitoFixtureExport }), "avito-account", "avito.v1");
    expect(reconcileNormalizedBatch(batch, {})).toMatchObject({ status: "not_comparable", metrics: [] });
  });

  it("rejects invalid reference and tolerance values", async () => {
    const batch = await collect(createVkAdsAdapter({ accountId: "vk-account", currency: "RUB", exportRows: vkFixtureExport }), "vk-account", "vk.v1");
    expect(() => reconcileNormalizedBatch(batch, { clicks: -1 })).toThrow("INVALID_REFERENCE_VALUE");
    expect(() => reconcileNormalizedBatch(batch, { clicks: 980 }, { relativeTolerance: -1 })).toThrow("INVALID_RECONCILIATION_TOLERANCE");
  });
});

