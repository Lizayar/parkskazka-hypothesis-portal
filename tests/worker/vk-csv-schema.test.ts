import { describe, expect, it } from "vitest";
import { createVkAdsCsvBatch, parseVkAdsCsv } from "@portal/worker/jobs/vk-csv-schema";

const english = "date,currency,campaignId,campaignName,adGroupId,adGroupName,adId,adName,creativeId,creativeName,copy,hook,offer,cta,landingUrl,utmSource,utmMedium,utmCampaign,spend,impressions,clicks\n2026-08-12,RUB,campaign-1,Summer,group-1,Families,ad-1,Control,creative-1,Hook A,Copy,Hook,Offer,CTA,https://parkskazka.com,vk,cpc,summer,";
const tail = "12 500,42 000,980\n";

describe("VK Ads CSV schema registry", () => {
  it("maps English headers, Russian-style number formatting and complete lineage", () => {
    const batch = createVkAdsCsvBatch(english + tail, {
      source: "vk_ads",
      accountId: "vk-account",
      from: "2026-08-12",
      to: "2026-08-12",
      schemaVersion: "vk.csv.v1",
      extractionMethod: "file_import",
    });
    expect(batch.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectLevel: "campaign", externalId: "campaign-1" }),
      expect.objectContaining({ objectLevel: "creative", externalId: "creative-1" }),
      expect.objectContaining({ objectLevel: "ad", externalId: "ad-1", metricValues: { spend: 12500, impressions: 42000, clicks: 980 } }),
    ]));
  });

  it("accepts Russian aliases and dd.mm.yyyy dates", () => {
    const csv = "Дата,Валюта,Кампания ID,Кампания,Группа объявлений ID,Группа объявлений,Объявление ID,Объявление,Креатив ID,Креатив,Текст,Хук,Оффер,CTA,Ссылка,UTM source,UTM medium,UTM campaign,Расход,Показы,Клики\n12.08.2026,RUB,c,g,a,group,d,ad,cr,creative,copy,hook,offer,cta,https://parkskazka.com,vk,cpc,campaign,1 250,2 000,50\n";
    expect(parseVkAdsCsv(csv)[0]).toMatchObject({ date: "2026-08-12", campaignId: "c" });
    expect(createVkAdsCsvBatch(csv, { source: "vk_ads", accountId: "a", from: "2026-08-12", to: "2026-08-12", schemaVersion: "vk.v1", extractionMethod: "file_import" }).rows.length).toBeGreaterThan(0);
  });

  it("rejects incomplete schema, invalid currency and invalid numbers", () => {
    expect(() => parseVkAdsCsv("date,currency\n2026-08-12,RUB\n")).toThrow("INVALID_VK_SCHEMA");
    expect(() => createVkAdsCsvBatch(english.replace("RUB", "BTC") + tail, { source: "vk_ads", accountId: "a", from: "2026-08-12", to: "2026-08-12", schemaVersion: "vk.v1", extractionMethod: "file_import" })).toThrow("INVALID_CURRENCY");
    expect(() => parseVkAdsCsv((english + tail).replace("12 500", "bad"))).toThrow("INVALID_VK_SPEND");
  });
});

