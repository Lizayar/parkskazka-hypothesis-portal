import { describe, expect, it } from "vitest";
import { createYandexMetricaAdapter } from "@portal/adapters/yandex-metrica/adapter";
import { mapYandexReport } from "@portal/adapters/yandex-metrica/mapper";
import { yandexFixtureReport } from "@portal/adapters/yandex-metrica/fixtures";

describe("Yandex Metrica read-only adapter", () => {
  it("maps campaign rows, goals and attribution context", () => {
    const rows = mapYandexReport(yandexFixtureReport);

    expect(rows).toEqual([
      expect.objectContaining({
        source: "yandex_metrica",
        objectLevel: "campaign",
        externalId: "campaign-summer",
        sessions: 1200,
        goals: { lead: 48, ticketPurchase: 12 },
        attributionModel: "lastsign",
        timezone: "Europe/Moscow",
      }),
    ]);
  });

  it("exposes only read operations and validates counter/period", async () => {
    const adapter = createYandexMetricaAdapter({
      counterId: "counter-fixture",
      timezone: "Europe/Moscow",
      report: yandexFixtureReport,
    });
    const capability = await adapter.discoverCapabilities();

    expect(capability.supported).toBe(true);
    expect(capability.metrics).toEqual(expect.arrayContaining(["sessions", "goals.lead"]));
    expect(Object.keys(adapter)).not.toEqual(
      expect.arrayContaining(["createGoal", "updateCounter", "deleteReport"]),
    );

    await expect(
      adapter.getStats({
        accountId: "counter-fixture",
        from: "2026-08-13",
        to: "2026-08-12",
        timezone: "Europe/Moscow",
        metricKeys: ["sessions"],
      }).next(),
    ).rejects.toThrow("INVALID_PERIOD");
  });

  it("returns an unsupported capability when the counter is unavailable", async () => {
    const adapter = createYandexMetricaAdapter({
      counterId: "counter-fixture",
      timezone: "Europe/Moscow",
      report: null,
    });

    await expect(adapter.discoverCapabilities()).resolves.toMatchObject({
      source: "yandex_metrica",
      supported: false,
      reason: "provider_unavailable",
    });
  });
});

