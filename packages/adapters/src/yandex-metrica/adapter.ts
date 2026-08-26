import type {
  AdapterListRequest,
  AdapterPage,
  AdapterStatsRequest,
  CapabilityReport,
  ReadOnlyAdsAdapter,
} from "../contracts.js";
import { AdapterError } from "../errors.js";
import { mapYandexReport, type YandexCanonicalRow } from "./mapper.js";
import type { YandexFixtureReport } from "./fixtures.js";

export type YandexMetricaAdapterOptions = {
  counterId: string;
  timezone: string;
  report: YandexFixtureReport | null;
};

function validateRequest(request: AdapterListRequest | AdapterStatsRequest, counterId: string, timezone: string): void {
  if (request.accountId !== counterId || !counterId.trim()) {
    throw new AdapterError("SOURCE_FAILURE", "Yandex Metrica counter is unavailable");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(request.from) || !/^\d{4}-\d{2}-\d{2}$/.test(request.to) || request.from > request.to) {
    throw new AdapterError("INVALID_PERIOD", "Yandex Metrica period is invalid");
  }
  if (request.timezone !== timezone || !request.timezone.trim()) {
    throw new AdapterError("INVALID_TIMEZONE", "Yandex Metrica timezone is invalid");
  }
}

export function createYandexMetricaAdapter(options: YandexMetricaAdapterOptions): ReadOnlyAdsAdapter {
  return {
    source: "yandex_metrica",
    async discoverCapabilities(): Promise<CapabilityReport> {
      if (!options.report) {
        return {
          source: "yandex_metrica",
          supported: false,
          objectLevels: [],
          metrics: [],
          reason: "provider_unavailable",
        };
      }
      return {
        source: "yandex_metrica",
        supported: true,
        objectLevels: ["campaign"],
        metrics: ["sessions", ...Object.keys(options.report.rows[0]?.goals ?? {}).map((goal) => `goals.${goal}`)],
      };
    },
    async *listObjects(request?: AdapterListRequest): AsyncGenerator<AdapterPage> {
      const effective = request ?? {
        accountId: options.counterId,
        from: options.report?.from ?? "",
        to: options.report?.to ?? "",
        timezone: options.timezone,
      };
      validateRequest(effective, options.counterId, options.timezone);
      if (!options.report) {
        throw new AdapterError("SOURCE_FAILURE", "Yandex Metrica report is unavailable");
      }
      const rows = mapYandexReport(options.report) as readonly YandexCanonicalRow[];
      yield { page: 1, hasNextPage: false, rows };
    },
    async *getStats(request?: AdapterStatsRequest): AsyncGenerator<AdapterPage> {
      const effective = request ?? {
        accountId: options.counterId,
        from: options.report?.from ?? "",
        to: options.report?.to ?? "",
        timezone: options.timezone,
        metricKeys: ["sessions"],
      };
      validateRequest(effective, options.counterId, options.timezone);
      if (!options.report) {
        throw new AdapterError("SOURCE_FAILURE", "Yandex Metrica report is unavailable");
      }
      const rows = mapYandexReport(options.report).map((row) => {
        const selected = Object.fromEntries(
          effective.metricKeys.flatMap((key) => {
            if (key === "sessions") return [[key, row.sessions]];
            if (key.startsWith("goals.")) return [[key, row.goals[key.slice("goals.".length)] ?? 0]];
            return [];
          }),
        );
        return { ...row, metrics: selected };
      });
      yield { page: 1, hasNextPage: false, rows };
    },
  };
}

