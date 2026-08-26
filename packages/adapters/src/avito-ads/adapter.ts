import type {
  AdapterListRequest,
  AdapterPage,
  AdapterStatsRequest,
  CapabilityReport,
  ReadOnlyAdsAdapter,
} from "../contracts.js";
import { AdapterError } from "../errors.js";
import type { AvitoNativeCreative } from "./fixtures.js";
import { mapAvitoCreatives } from "./mapper.js";

export type AvitoAdsAdapterOptions = {
  accountId: string;
  timezone?: string;
  exportRows: readonly AvitoNativeCreative[] | null;
};

function validateRequest(request: AdapterListRequest | AdapterStatsRequest, options: AvitoAdsAdapterOptions): void {
  if (request.accountId !== options.accountId) {
    throw new AdapterError("SOURCE_FAILURE", "Avito Ads account is unavailable");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.from) || !/^\d{4}-\d{2}-\d{2}$/.test(request.to) || request.from > request.to) {
    throw new AdapterError("INVALID_PERIOD", "Avito Ads period is invalid");
  }
  if (request.timezone !== (options.timezone ?? "Europe/Moscow")) {
    throw new AdapterError("INVALID_TIMEZONE", "Avito Ads timezone is invalid");
  }
}

export function createAvitoAdsAdapter(options: AvitoAdsAdapterOptions): ReadOnlyAdsAdapter {
  return {
    source: "avito_ads",
    async discoverCapabilities(): Promise<CapabilityReport> {
      if (!options.exportRows) {
        return {
          source: "avito_ads",
          supported: false,
          objectLevels: [],
          metrics: [],
          reason: "provider_unavailable",
        };
      }
      return {
        source: "avito_ads",
        supported: true,
        extractionMethod: "file_import",
        objectLevels: ["campaign", "ad", "creative"],
        metrics: ["creative_quality", "moderation_status"],
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
      if (!options.exportRows) throw new AdapterError("SOURCE_FAILURE", "Avito Ads export is unavailable");
      yield { page: 1, hasNextPage: false, rows: mapAvitoCreatives(options.exportRows) };
    },
    async *getStats(request?: AdapterStatsRequest): AsyncGenerator<AdapterPage> {
      const effective = request ?? {
        accountId: options.accountId,
        from: options.exportRows?.[0]?.date ?? "",
        to: options.exportRows?.[0]?.date ?? "",
        timezone: options.timezone ?? "Europe/Moscow",
        metricKeys: ["creative_quality", "moderation_status"],
      };
      validateRequest(effective, options);
      if (!options.exportRows) throw new AdapterError("SOURCE_FAILURE", "Avito Ads export is unavailable");
      yield { page: 1, hasNextPage: false, rows: mapAvitoCreatives(options.exportRows) };
    },
  };
}

