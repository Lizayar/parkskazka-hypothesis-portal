import { createHash } from "node:crypto";
import { AdapterError } from "../errors.js";
import type { TelegramAdRow } from "./fixtures.js";

export type TelegramCanonicalRow = {
  source: "telegram_ads";
  objectLevel: "campaign" | "ad" | "creative";
  externalId: string;
  name: string;
  channelExternalId: string;
  campaignExternalId?: string;
  messageText?: string;
  mediaType?: TelegramAdRow["mediaType"];
  mediaUrl?: string;
  destinationUrl?: string;
  hook?: string;
  cta?: string;
  targeting?: TelegramAdRow["targeting"];
  utm?: Readonly<Record<string, string>>;
  contentHash?: string;
  date?: string;
  currency?: TelegramAdRow["currency"];
  spend?: number;
  impressions?: number;
  clicks?: number;
};

function validate(row: TelegramAdRow): void {
  if (!row.channelExternalId || !row.campaignExternalId || !row.messageExternalId || !row.creativeExternalId) {
    throw new AdapterError("INVALID_HIERARCHY", "Telegram Ads channel/message lineage is incomplete");
  }
  if (!row.utm.source || !row.utm.medium || !row.utm.campaign) {
    throw new AdapterError("INVALID_UTM", "Telegram Ads UTM lineage is incomplete");
  }
  if (!row.destinationUrl.startsWith("https://")) {
    throw new AdapterError("INVALID_UTM", "Telegram Ads destination URL must use HTTPS");
  }
}

export function mapTelegramAds(rows: readonly TelegramAdRow[]): readonly TelegramCanonicalRow[] {
  const result: TelegramCanonicalRow[] = [];
  const campaigns = new Set<string>();
  const ads = new Set<string>();
  const creatives = new Set<string>();

  for (const row of rows) {
    validate(row);
    if (!campaigns.has(row.campaignExternalId)) {
      campaigns.add(row.campaignExternalId);
      result.push({
        source: "telegram_ads",
        objectLevel: "campaign",
        externalId: row.campaignExternalId,
        name: row.campaignName,
        channelExternalId: row.channelExternalId,
        date: row.date,
      });
    }
    if (!ads.has(row.messageExternalId)) {
      ads.add(row.messageExternalId);
      result.push({
        source: "telegram_ads",
        objectLevel: "ad",
        externalId: row.messageExternalId,
        name: `Message ${row.messageExternalId}`,
        channelExternalId: row.channelExternalId,
        campaignExternalId: row.campaignExternalId,
        messageText: row.messageText,
        mediaType: row.mediaType,
        mediaUrl: row.mediaUrl,
        destinationUrl: row.destinationUrl,
        targeting: row.targeting,
        utm: { ...row.utm },
        date: row.date,
      });
    }
    if (!creatives.has(row.creativeExternalId)) {
      creatives.add(row.creativeExternalId);
      const contentHash = createHash("sha256")
        .update([row.creativeExternalId, row.messageText, row.mediaUrl ?? "", row.hook, row.cta].join("\u001f"), "utf8")
        .digest("hex");
      result.push({
        source: "telegram_ads",
        objectLevel: "creative",
        externalId: row.creativeExternalId,
        name: `Creative ${row.creativeExternalId}`,
        channelExternalId: row.channelExternalId,
        campaignExternalId: row.campaignExternalId,
        messageText: row.messageText,
        mediaType: row.mediaType,
        mediaUrl: row.mediaUrl,
        destinationUrl: row.destinationUrl,
        hook: row.hook,
        cta: row.cta,
        targeting: row.targeting,
        utm: { ...row.utm },
        contentHash,
        date: row.date,
      });
    }
  }
  return result;
}

export function mapTelegramStats(rows: readonly TelegramAdRow[], metricKeys: readonly string[]): readonly TelegramCanonicalRow[] {
  return rows.map((row) => ({
    source: "telegram_ads",
    objectLevel: "ad",
    externalId: row.messageExternalId,
    name: `Message ${row.messageExternalId}`,
    channelExternalId: row.channelExternalId,
    campaignExternalId: row.campaignExternalId,
    currency: row.currency,
    spend: metricKeys.includes("spend") ? row.spend : undefined,
    impressions: metricKeys.includes("impressions") ? row.impressions : undefined,
    clicks: metricKeys.includes("clicks") ? row.clicks : undefined,
    targeting: row.targeting,
    utm: { ...row.utm },
    date: row.date,
  }));
}

