import type { ObjectLevel, Source } from "@portal/db/schema/core";

export type AdapterRow = Readonly<Record<string, unknown>>;

export type AdapterPage = {
  page: number;
  hasNextPage: boolean;
  rows: readonly AdapterRow[];
};

export type CapabilityReport = {
  source: Source;
  supported: boolean;
  objectLevels: readonly ObjectLevel[];
  metrics: readonly string[];
  reason?: "provider_unavailable" | "scope_not_granted" | "endpoint_unsupported";
};

export type AdapterListRequest = {
  accountId: string;
  from: string;
  to: string;
  timezone: string;
  objectLevel?: ObjectLevel;
};

export type AdapterStatsRequest = AdapterListRequest & {
  metricKeys: readonly string[];
};

export interface ReadOnlyAdsAdapter {
  readonly source: Source;
  discoverCapabilities(): Promise<CapabilityReport>;
  listObjects(request?: AdapterListRequest): AsyncGenerator<AdapterPage>;
  getStats(request?: AdapterStatsRequest): AsyncGenerator<AdapterPage>;
}

export type UnsupportedAdapter = {
  readonly source: Source;
  readonly supported: false;
};

export type AdapterLike = ReadOnlyAdsAdapter | UnsupportedAdapter;

export function adapterCapabilities(adapter: AdapterLike) {
  return {
    source: adapter.source,
    readOnly: true as const,
    mutationMethods: [] as const,
  };
}

