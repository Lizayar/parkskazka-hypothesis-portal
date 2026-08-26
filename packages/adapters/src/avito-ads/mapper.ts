import { createHash } from "node:crypto";
import { AdapterError } from "../errors.js";
import type { AvitoNativeCreative } from "./fixtures.js";

export type AvitoCreativeRow = {
  source: "avito_ads";
  objectLevel: "creative";
  externalId: string;
  campaignExternalId: string;
  adExternalId: string;
  name: string;
  aspectRatio: "4:5";
  width: number;
  height: number;
  fileBytes: number;
  title: string;
  text: string;
  imageUrl: string;
  moderationStatus: "approved" | "pending" | "rejected";
  contentHash: string;
  utm: Readonly<Record<string, string>>;
  date: string;
};

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TITLE_LENGTH = 50;
const MAX_TEXT_LENGTH = 200;

function validateCreative(creative: AvitoNativeCreative): void {
  if (creative.width !== 600 || creative.height !== 750) {
    throw new AdapterError("INVALID_CREATIVE", "Avito native creative must be 600x750");
  }
  if (creative.fileBytes >= MAX_BYTES) {
    throw new AdapterError("INVALID_CREATIVE", "Avito native creative exceeds 2 MB");
  }
  if (creative.title.length > MAX_TITLE_LENGTH || creative.text.length > MAX_TEXT_LENGTH) {
    throw new AdapterError("INVALID_CREATIVE", "Avito native creative text exceeds contract limits");
  }
  if (creative.moderationStatus === "rejected") {
    throw new AdapterError("INVALID_CREATIVE", "Avito native creative is rejected by moderation");
  }
  if (!creative.utm.source || !creative.utm.medium || !creative.utm.campaign) {
    throw new AdapterError("INVALID_UTM", "Avito UTM lineage is incomplete");
  }
}

export function mapAvitoCreatives(creatives: readonly AvitoNativeCreative[]): readonly AvitoCreativeRow[] {
  return creatives.map((creative) => {
    validateCreative(creative);
    const contentHash = createHash("sha256")
      .update([creative.creativeExternalId, creative.title, creative.text, creative.imageUrl].join("\u001f"), "utf8")
      .digest("hex");
    return {
      source: "avito_ads",
      objectLevel: "creative",
      externalId: creative.creativeExternalId,
      campaignExternalId: creative.campaignExternalId,
      adExternalId: creative.adExternalId,
      name: creative.creativeName,
      aspectRatio: "4:5",
      width: creative.width,
      height: creative.height,
      fileBytes: creative.fileBytes,
      title: creative.title,
      text: creative.text,
      imageUrl: creative.imageUrl,
      moderationStatus: creative.moderationStatus,
      contentHash,
      utm: { ...creative.utm },
      date: creative.date,
    };
  });
}

