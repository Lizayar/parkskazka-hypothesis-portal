import { mapVkExport, mapVkStats, type VkCanonicalRow } from "@portal/adapters/vk-ads/mapper";
import type { VkExportRow } from "@portal/adapters/vk-ads/fixtures";
import type { Snapshot } from "@portal/db/schema/ingestion";
import { normalizeProviderRow, validateNormalizedBatch, type NormalizedProviderBatch, type NormalizedProviderRow } from "./provider-ingestion.js";
import { parseCsvRecords, type CsvExportMetadata } from "./export-intake.js";

type VkField = Exclude<keyof VkExportRow, "utm"> | "utmSource" | "utmMedium" | "utmCampaign" | "utmContent";

const aliases: Readonly<Record<VkField, readonly string[]>> = {
  date: ["date", "дата"],
  currency: ["currency", "валюта"],
  campaignId: ["campaignid", "campaign_id", "кампанияid", "кампанияид"],
  campaignName: ["campaignname", "campaign", "кампания", "названиекампании"],
  adGroupId: ["adgroupid", "ad_group_id", "группаобъявленийid", "группаобъявленийид"],
  adGroupName: ["adgroupname", "adgroup", "группаобъявлений", "названиегруппыобъявлений"],
  adId: ["adid", "ad_id", "объявлениеid", "объявлениеид"],
  adName: ["adname", "ad", "объявление", "названиеобъявления"],
  creativeId: ["creativeid", "creative_id", "креативid", "креативид"],
  creativeName: ["creativename", "creative", "креатив", "названиекреатива"],
  copy: ["copy", "text", "текст", "текстроекламы"],
  hook: ["hook", "хук"],
  offer: ["offer", "оффер", "предложение"],
  cta: ["cta", "призыв", "призывкдействию"],
  landingUrl: ["landingurl", "landing_url", "ссылка", "url", "посадочнаястраница"],
  utmSource: ["utmsource", "utm_source", "utm source"],
  utmMedium: ["utmmedium", "utm_medium", "utm medium"],
  utmCampaign: ["utmcampaign", "utm_campaign", "utm campaign"],
  utmContent: ["utmcontent", "utm_content", "utm content"],
  spend: ["spend", "расход", "затраты", "расходы"],
  impressions: ["impressions", "показы"],
  clicks: ["clicks", "клики"],
};

const required: readonly VkField[] = ["date", "currency", "campaignId", "campaignName", "adGroupId", "adGroupName", "adId", "adName", "creativeId", "creativeName", "copy", "hook", "offer", "cta", "landingUrl", "utmSource", "utmMedium", "utmCampaign", "spend", "impressions", "clicks"];

function normalizeHeader(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/[«»"'()./\\-]/g, "").replace(/\s+/g, "").trim();
}

function resolveColumns(headers: readonly string[]): Map<VkField, string> {
  const byNormalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const resolved = new Map<VkField, string>();
  for (const field of required) {
    const match = aliases[field].map(normalizeHeader).find((alias) => byNormalized.has(alias));
    if (!match) throw new Error("INVALID_VK_SCHEMA");
    resolved.set(field, byNormalized.get(match)!);
  }
  for (const field of Object.keys(aliases) as VkField[]) {
    if (resolved.has(field)) continue;
    const match = aliases[field].map(normalizeHeader).find((alias) => byNormalized.has(alias));
    if (match) resolved.set(field, byNormalized.get(match)!);
  }
  if (new Set(resolved.values()).size !== resolved.size) throw new Error("INVALID_VK_SCHEMA");
  return resolved;
}

function text(row: Readonly<Record<string, string>>, columns: Map<VkField, string>, field: VkField): string {
  const value = row[columns.get(field) ?? ""]?.trim();
  if (!value) throw new Error(`INVALID_VK_${String(field).toUpperCase()}`);
  return value;
}

function numberValue(value: string, field: VkField): number {
  const cleaned = value.replace(/[\u00a0\s]/g, "").replace(/,/g, ".");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`INVALID_VK_${String(field).toUpperCase()}`);
  return parsed;
}

function dateValue(value: string): string {
  const iso = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(iso);
  if (!match) throw new Error("INVALID_VK_DATE");
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseRows(csv: string): readonly VkExportRow[] {
  const records = parseCsvRecords(csv);
  const headers = Object.keys(records[0] ?? {});
  const columns = resolveColumns(headers);
  return records.map((row) => {
    const currency = text(row, columns, "currency");
    if (currency !== "RUB" && currency !== "EUR") throw new Error("INVALID_CURRENCY");
    return {
    date: dateValue(text(row, columns, "date")),
    currency: currency as VkExportRow["currency"],
    campaignId: text(row, columns, "campaignId"),
    campaignName: text(row, columns, "campaignName"),
    adGroupId: text(row, columns, "adGroupId"),
    adGroupName: text(row, columns, "adGroupName"),
    adId: text(row, columns, "adId"),
    adName: text(row, columns, "adName"),
    creativeId: text(row, columns, "creativeId"),
    creativeName: text(row, columns, "creativeName"),
    copy: text(row, columns, "copy"),
    hook: text(row, columns, "hook"),
    offer: text(row, columns, "offer"),
    cta: text(row, columns, "cta"),
    landingUrl: text(row, columns, "landingUrl"),
    utm: {
      source: text(row, columns, "utmSource"),
      medium: text(row, columns, "utmMedium"),
      campaign: text(row, columns, "utmCampaign"),
      content: columns.has("utmContent") ? row[columns.get("utmContent")!]?.trim() || undefined : undefined,
    },
    spend: numberValue(text(row, columns, "spend"), "spend"),
    impressions: numberValue(text(row, columns, "impressions"), "impressions"),
    clicks: numberValue(text(row, columns, "clicks"), "clicks"),
    };
  });
}

export type VkCsvMetadata = CsvExportMetadata;

export function parseVkAdsCsv(csv: string): readonly VkExportRow[] {
  return parseRows(csv);
}

export function createVkAdsCsvBatch(csv: string, metadata: VkCsvMetadata): NormalizedProviderBatch {
  if (metadata.source !== "vk_ads") throw new Error("SOURCE_MISMATCH");
  const rows = parseRows(csv);
  const canonical = [...mapVkExport(rows), ...mapVkStats(rows, ["spend", "impressions", "clicks"])] as readonly VkCanonicalRow[];
  const merged = new Map<string, NormalizedProviderRow>();
  for (const row of canonical) {
    const normalized = normalizeProviderRow("vk_ads", row as unknown as Readonly<Record<string, unknown>>);
    const key = `${normalized.objectLevel}:${normalized.externalId}`;
    const previous = merged.get(key);
    merged.set(key, previous ? { ...previous, metricValues: { ...(previous.metricValues ?? {}), ...(normalized.metricValues ?? {}) } } : normalized);
  }
  const batch: NormalizedProviderBatch = { ...metadata, extractionMethod: metadata.extractionMethod as Snapshot["extractionMethod"], source: "vk_ads", rows: [...merged.values()] };
  validateNormalizedBatch(batch);
  return batch;
}

