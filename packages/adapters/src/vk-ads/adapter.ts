import type {
  AdapterListRequest,
  AdapterPage,
  AdapterStatsRequest,
  CapabilityReport,
  ReadOnlyAdsAdapter,
} from "../contracts.js";
import { AdapterError } from "../errors.js";
import type { VkExportRow } from "./fixtures.js";
import { mapVkExport, mapVkStats } from "./mapper.js";

export type VkAdsAdapterOptions = {
  accountId: string;
  currency: string;
  timezone?: string;
  exportRows: readonly VkExportRow[] | null;
};

function validateRequest(request: AdapterListRequest | AdapterStatsRequest, options: VkAdsAdapterOptions): void {
  if (request.accountId !== options.accountId) {
    throw new AdapterError("SOURCE_FAILURE", "VK Ads account is unavailable");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.from) || !/^\d{4}-\d{2}-\d{2}$/.test(request.to) || request.from > request.to) {
    throw new AdapterError("INVALID_PERIOD", "VK Ads period is invalid");
  }
  if (request.timezone !== (options.timezone ?? "Europe/Moscow")) {
    throw new AdapterError("INVALID_TIMEZONE", "VK Ads timezone is invalid");
  }
  if (options.currency !== "RUB") {
    throw new AdapterError("INVALID_CURRENCY", "VK Ads export must be in RUB");
  }
}

export function createVkAdsAdapter(options: VkAdsAdapterOptions): ReadOnlyAdsAdapter {
  return {
    source: "vk_ads",
    async discoverCapabilities(): Promise<CapabilityReport> {
      if (!options.exportRows) {
        return {
          source: "vk_ads",
          supported: false,
          objectLevels: [],
          metrics: [],
          reason: "provider_unavailable",
        };
      }
      return {
        source: "vk_ads",
        supported: true,
        extractionMethod: "file_import",
        objectLevels: ["campaign", "ad_group", "ad", "creative"],
        metrics: ["spend", "impressions", "clicks"],
      };
    },
    async *listObjects(request?: AdapterListRequest): AsyncGenerator<AdapterPage> {
      const effective = request ?? {
        accountId: options.accountId,
        from: options.exportRows?.[0]?.date ?? "",
        to: options.exportRows?.[0]?.date ?? "",
        timezone: options.timezone ?? "Europe/Moscow",
      };
      validateRequest(effective, options);
      if (!options.exportRows) throw new AdapterError("SOURCE_FAILURE", "VK Ads export is unavailable");
      yield { page: 1, hasNextPage: false, rows: mapVkExport(options.exportRows) };
    },
    async *getStats(request?: AdapterStatsRequest): AsyncGenerator<AdapterPage> {
      const effective = request ?? {
        accountId: options.accountId,
        from: options.exportRows?.[0]?.date ?? "",
        to: options.exportRows?.[0]?.date ?? "",
        timezone: options.timezone ?? "Europe/Moscow",
        metricKeys: ["spend", "impressions", "clicks"],
      };
      validateRequest(effective, options);
      if (!options.exportRows) throw new AdapterError("SOURCE_FAILURE", "VK Ads export is unavailable");
      yield { page: 1, hasNextPage: false, rows: mapVkStats(options.exportRows, effective.metricKeys) };
    },
  };
}

