export type PortalSource = "yandex_metrica" | "avito_ads" | "vk_ads" | "telegram_ads";

export type PortalDateRange = {
  from: string;
  to: string;
  timezone: string;
};

export type PortalFilters = PortalDateRange & {
  source?: PortalSource;
  status?: string;
  ownerSubjectId?: string;
};

const sources: readonly PortalSource[] = ["yandex_metrica", "avito_ads", "vk_ads", "telegram_ads"];

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parsePortalFilters(input: {
  from?: unknown;
  to?: unknown;
  timezone?: unknown;
  source?: unknown;
  status?: unknown;
  ownerSubjectId?: unknown;
}): PortalFilters {
  const from = input.from ?? "";
  const to = input.to ?? "";
  if (!isDate(from) || !isDate(to) || from > to) throw new Error("INVALID_DATE_RANGE");
  const timezone = typeof input.timezone === "string" && input.timezone.trim()
    ? input.timezone
    : "Europe/Moscow";
  if (input.source !== undefined && !sources.includes(input.source as PortalSource)) {
    throw new Error("INVALID_SOURCE_FILTER");
  }
  return {
    from,
    to,
    timezone,
    ...(input.source ? { source: input.source as PortalSource } : {}),
    ...(typeof input.status === "string" && input.status ? { status: input.status } : {}),
    ...(typeof input.ownerSubjectId === "string" && input.ownerSubjectId ? { ownerSubjectId: input.ownerSubjectId } : {}),
  };
}

export type DashboardInput = {
  dateRange: PortalDateRange;
  source: PortalSource;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  quality: "valid" | "partial" | "invalid";
  maturity: "insufficient" | "mature";
};

export type DashboardSummary = DashboardInput & {
  ctr: number | null;
  cpl: number | null;
  qualityBadge: DashboardInput["quality"];
  maturityBadge: DashboardInput["maturity"];
};

export function buildDashboardSummary(input: DashboardInput): DashboardSummary {
  return {
    ...input,
    ctr: input.impressions > 0 ? input.clicks / input.impressions : null,
    cpl: input.leads > 0 ? input.spend / input.leads : null,
    qualityBadge: input.quality,
    maturityBadge: input.maturity,
  };
}

export type HypothesisJournalItem = {
  id: string;
  title: string;
  status: "draft" | "planned" | "running" | "completed" | "stopped";
  ownerSubjectId: string;
  source: PortalSource;
  startsOn: string;
  endsOn: string;
  primaryMetric: string;
  decision: "scale" | "iterate" | "stop" | "inconclusive";
};

export type HypothesisJournalFilters = {
  status?: HypothesisJournalItem["status"];
  ownerSubjectId?: string;
  source?: PortalSource;
};

export function buildHypothesisJournal(
  items: readonly HypothesisJournalItem[],
  filters: HypothesisJournalFilters = {},
): readonly HypothesisJournalItem[] {
  return items
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => !filters.ownerSubjectId || item.ownerSubjectId === filters.ownerSubjectId)
    .filter((item) => !filters.source || item.source === filters.source)
    .map((item) => ({ ...item }));
}

export type ExplorerInput = {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  adId: string;
  adName: string;
  creativeId: string;
  creativeName: string;
  source: PortalSource;
};

export type ExplorerCreative = Pick<ExplorerInput, "creativeId" | "creativeName">;
export type ExplorerAd = {
  adId: string;
  adName: string;
  creatives: readonly ExplorerCreative[];
};
export type ExplorerAdGroup = {
  adGroupId: string;
  adGroupName: string;
  ads: readonly ExplorerAd[];
};
export type ExplorerCampaign = {
  campaignId: string;
  campaignName: string;
  source: PortalSource;
  adGroups: readonly ExplorerAdGroup[];
};

export function buildExplorerTree(rows: readonly ExplorerInput[]): readonly ExplorerCampaign[] {
  const campaigns = new Map<string, ExplorerCampaign>();
  for (const row of rows) {
    let campaign = campaigns.get(row.campaignId);
    if (!campaign) {
      campaign = { campaignId: row.campaignId, campaignName: row.campaignName, source: row.source, adGroups: [] };
      campaigns.set(row.campaignId, campaign);
    }
    const groups = [...campaign.adGroups];
    let group = groups.find((candidate) => candidate.adGroupId === row.adGroupId);
    if (!group) {
      group = { adGroupId: row.adGroupId, adGroupName: row.adGroupName, ads: [] };
      groups.push(group);
    }
    const ads = [...group.ads];
    let ad = ads.find((candidate) => candidate.adId === row.adId);
    if (!ad) {
      ad = { adId: row.adId, adName: row.adName, creatives: [] };
      ads.push(ad);
    }
    if (!ad.creatives.some((creative) => creative.creativeId === row.creativeId)) {
      ad.creatives = [...ad.creatives, { creativeId: row.creativeId, creativeName: row.creativeName }];
    }
    group.ads = ads;
    campaign.adGroups = groups;
  }
  return [...campaigns.values()];
}

