import { createHash } from "node:crypto";
import type { ObjectLevel } from "@portal/db/schema/core";
import { AdapterError } from "../errors.js";
import type { VkExportRow } from "./fixtures.js";

export type VkCanonicalRow = {
  source: "vk_ads";
  objectLevel: ObjectLevel;
  externalId: string;
  name: string;
  parentExternalId?: string;
  contentHash?: string;
  copy?: string;
  hook?: string;
  offer?: string;
  cta?: string;
  landingUrl?: string;
  utm?: Readonly<Record<string, string>>;
  date?: string;
  currency?: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
};

function hashCreative(row: VkExportRow): string {
  return createHash("sha256")
    .update([row.creativeId, row.copy, row.hook, row.offer, row.cta].join("\u001f"), "utf8")
    .digest("hex");
}

export function mapVkExport(rows: readonly VkExportRow[]): readonly VkCanonicalRow[] {
  const mapped: VkCanonicalRow[] = [];
  const campaigns = new Set<string>();
  const groups = new Set<string>();
  const ads = new Set<string>();
  const creatives = new Set<string>();

  for (const row of rows) {
    if (!row.campaignId || !row.adGroupId || !row.adId || !row.creativeId) {
      throw new AdapterError("INVALID_HIERARCHY", "VK Ads hierarchy is incomplete");
    }
    if (!row.utm.source || !row.utm.medium || !row.utm.campaign) {
      throw new AdapterError("INVALID_UTM", "VK Ads UTM lineage is incomplete");
    }
    if (!campaigns.has(row.campaignId)) {
      campaigns.add(row.campaignId);
      mapped.push({ source: "vk_ads", objectLevel: "campaign", externalId: row.campaignId, name: row.campaignName });
    }
    if (!groups.has(row.adGroupId)) {
      groups.add(row.adGroupId);
      mapped.push({
        source: "vk_ads",
        objectLevel: "ad_group",
        externalId: row.adGroupId,
        name: row.adGroupName,
        parentExternalId: row.campaignId,
      });
    }
    if (!ads.has(row.adId)) {
      ads.add(row.adId);
      mapped.push({
        source: "vk_ads",
        objectLevel: "ad",
        externalId: row.adId,
        name: row.adName,
        parentExternalId: row.adGroupId,
      });
    }
    if (!creatives.has(row.creativeId)) {
      creatives.add(row.creativeId);
      mapped.push({
        source: "vk_ads",
        objectLevel: "creative",
        externalId: row.creativeId,
        name: row.creativeName,
        parentExternalId: row.adId,
        contentHash: hashCreative(row),
        copy: row.copy,
        hook: row.hook,
        offer: row.offer,
        cta: row.cta,
        landingUrl: row.landingUrl,
        utm: { ...row.utm },
      });
    }
  }
  return mapped;
}

export function mapVkStats(rows: readonly VkExportRow[], metricKeys: readonly string[]): readonly VkCanonicalRow[] {
  return rows.map((row) => ({
    source: "vk_ads",
    objectLevel: "ad",
    externalId: row.adId,
    name: row.adName,
    parentExternalId: row.adGroupId,
    date: row.date,
    currency: row.currency,
    spend: metricKeys.includes("spend") ? row.spend : undefined,
    impressions: metricKeys.includes("impressions") ? row.impressions : undefined,
    clicks: metricKeys.includes("clicks") ? row.clicks : undefined,
    utm: { ...row.utm },
  }));
}

