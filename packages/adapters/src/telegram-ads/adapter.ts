import type {
  AdapterListRequest,
  AdapterPage,
  AdapterStatsRequest,
  CapabilityReport,
  ReadOnlyAdsAdapter,
} from "../contracts.js";
import { AdapterError } from "../errors.js";
import type { TelegramAdRow } from "./fixtures.js";
import { mapTelegramAds, mapTelegramStats } from "./mapper.js";

export type TelegramAdsAdapterOptions = {
  accountId: string;
  timezone?: string;
  exportRows: readonly TelegramAdRow[] | null;
};

function validateRequest(request: AdapterListRequest | AdapterStatsRequest, options: TelegramAdsAdapterOptions): void {
  if (request.accountId !== options.accountId) {
    throw new AdapterError("SOURCE_FAILURE", "Telegram Ads account is unavailable");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.from) || !/^\d{4}-\d{2}-\d{2}$/.test(request.to) || request.from > request.to) {
    throw new AdapterError("INVALID_PERIOD", "Telegram Ads period is invalid");
  }
  if (request.timezone !== (options.timezone ?? "Europe/Moscow")) {
    throw new AdapterError("INVALID_TIMEZONE", "Telegram Ads timezone is invalid");
  }
}

export function createTelegramAdsAdapter(options: TelegramAdsAdapterOptions): ReadOnlyAdsAdapter {
  return {
    source: "telegram_ads",
    async discoverCapabilities(): Promise<CapabilityReport> {
      if (!options.exportRows) {
        return {
          source: "telegram_ads",
          supported: false,
          objectLevels: [],
          metrics: [],
          reason: "provider_unavailable",
        };
      }
      return {
        source: "telegram_ads",
        supported: true,
        extractionMethod: "file_import",
        objectLevels: ["campaign", "ad", "creative"],
        metrics: ["spend", "impressions", "clicks", "targeting"],
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
      if (!options.exportRows) throw new AdapterError("SOURCE_FAILURE", "Telegram Ads export is unavailable");
      yield { page: 1, hasNextPage: false, rows: mapTelegramAds(options.exportRows) };
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
      if (!options.exportRows) throw new AdapterError("SOURCE_FAILURE", "Telegram Ads export is unavailable");
      yield { page: 1, hasNextPage: false, rows: mapTelegramStats(options.exportRows, effective.metricKeys) };
    },
  };
}

