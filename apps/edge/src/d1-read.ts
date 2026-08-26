import type { D1DatabaseLike } from "./index.js";

export type D1ReadQuery = {
  source?: string;
  from?: string;
  to?: string;
};

type MetricAggregate = {
  metric_key: string;
  value: number | null;
  quality_status: string;
};

type HypothesisRow = {
  id: string;
  title: string;
  status: string;
  owner_subject_id: string;
  starts_on: string;
  ends_on: string;
  primary_metric: string;
  decision: string;
  source: string | null;
};

type ExplorerRow = {
  campaign_id: string;
  campaign_name: string;
  source: string;
  ad_group_id: string | null;
  ad_group_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  creative_id: string | null;
  creative_name: string | null;
  campaign_snapshot_id: string | null;
  ad_group_snapshot_id: string | null;
  ad_snapshot_id: string | null;
  creative_snapshot_id: string | null;
};

function dateClause(alias: string, query: D1ReadQuery): { sql: string; values: string[] } {
  const clauses: string[] = [];
  const values: string[] = [];
  if (query.from) {
    clauses.push(`${alias}.period_to >= ?`);
    values.push(query.from);
  }
  if (query.to) {
    clauses.push(`${alias}.period_from <= ?`);
    values.push(query.to);
  }
  return { sql: clauses.length > 0 ? ` AND ${clauses.join(" AND ")}` : "", values };
}

function sourceClause(alias: string, query: D1ReadQuery): { sql: string; values: string[] } {
  return query.source ? { sql: ` AND ${alias}.source = ?`, values: [query.source] } : { sql: "", values: [] };
}

function qualityBadge(rows: MetricAggregate[]): "valid" | "partial" | "not_loaded" {
  if (rows.length === 0) return "not_loaded";
  return rows.every((row) => row.quality_status === "valid") ? "valid" : "partial";
}

export async function readD1Summary(db: D1DatabaseLike, query: D1ReadQuery) {
  const dates = dateClause("mo", query);
  const source = sourceClause("mo", query);
  const result = await db
    .prepare(
      `SELECT mo.metric_key, SUM(COALESCE(mo.value, 0)) AS value, MIN(mo.quality_status) AS quality_status
       FROM metric_observation mo
       WHERE 1 = 1${dates.sql}${source.sql}
       GROUP BY mo.metric_key`,
    )
    .bind(...dates.values, ...source.values)
    .all<MetricAggregate>();

  const metricRows = result.results as MetricAggregate[];
  const metrics = new Map(metricRows.map((row: MetricAggregate) => [row.metric_key, Number(row.value ?? 0)]));
  const summary = {
    source: query.source ?? "all",
    spend: metrics.get("spend") ?? 0,
    impressions: metrics.get("impressions") ?? 0,
    clicks: metrics.get("clicks") ?? 0,
    leads: metrics.get("leads") ?? 0,
    qualityBadge: qualityBadge(metricRows),
    maturityBadge: metricRows.length > 0 ? "mature" : "not_loaded",
  };
  return { summary, quality: summary.qualityBadge };
}

export async function readD1Hypotheses(db: D1DatabaseLike, query: D1ReadQuery) {
  const dates: string[] = [];
  const dateValues: string[] = [];
  if (query.from) {
    dates.push("h.ends_on >= ?");
    dateValues.push(query.from);
  }
  if (query.to) {
    dates.push("h.starts_on <= ?");
    dateValues.push(query.to);
  }
  const observationDates = dateClause("mo", query);
  const observationSource = sourceClause("mo", query);
  const exists = query.source || observationDates.sql
    ? ` AND EXISTS (SELECT 1 FROM metric_observation mo WHERE mo.hypothesis_id = h.id${observationDates.sql}${observationSource.sql})`
    : "";
  const rows = await db
    .prepare(
      `SELECT h.id, h.title, h.status, h.owner_subject_id, h.starts_on, h.ends_on,
              h.primary_metric, h.decision,
              (SELECT mo.source FROM metric_observation mo WHERE mo.hypothesis_id = h.id ORDER BY mo.period_to DESC LIMIT 1) AS source
       FROM hypothesis h
       WHERE 1 = 1${dates.length ? ` AND ${dates.join(" AND ")}` : ""}${exists}
       ORDER BY h.starts_on DESC, h.id ASC`,
    )
    .bind(...dateValues, ...observationDates.values, ...observationSource.values)
    .all<HypothesisRow>();

  const hypothesisRows = rows.results as HypothesisRow[];
  return hypothesisRows.map((row: HypothesisRow) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    ownerSubjectId: row.owner_subject_id,
    source: row.source ?? "unknown",
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    primaryMetric: row.primary_metric,
    decision: row.decision,
  }));
}

export async function readD1Explorer(db: D1DatabaseLike, query: D1ReadQuery) {
  const dates = dateClause("ss", query);
  const source = sourceClause("ss", query);
  const newerDates = dateClause("newer", query);
  const newerSource = sourceClause("newer", query);
  const campaignSource = query.source ? " AND c.source = ?" : "";
  const campaignValues = query.source ? [query.source] : [];
  const result = await db
    .prepare(
      `WITH selected_snapshots AS (
         SELECT ss.id, ss.source, ss.account_id
         FROM source_snapshot ss
         WHERE 1 = 1${dates.sql}${source.sql}
           AND NOT EXISTS (
             SELECT 1 FROM source_snapshot newer
             WHERE newer.source = ss.source
               AND newer.account_id = ss.account_id
               AND newer.fetched_at > ss.fetched_at${newerDates.sql}${newerSource.sql}
           )
       )
       SELECT c.id AS campaign_id, c.name AS campaign_name, c.source,
              ag.id AS ad_group_id, ag.name AS ad_group_name,
              a.id AS ad_id, a.name AS ad_name,
              cr.id AS creative_id, cr.name AS creative_name,
              pc.snapshot_id AS campaign_snapshot_id,
              pg.snapshot_id AS ad_group_snapshot_id,
              pa.snapshot_id AS ad_snapshot_id,
              pcr.snapshot_id AS creative_snapshot_id
       FROM campaign c
       JOIN selected_snapshots ss ON ss.account_id = c.account_id AND ss.source = c.source
       LEFT JOIN ad_group ag ON ag.campaign_id = c.id
       LEFT JOIN ad a ON a.ad_group_id = ag.id
       LEFT JOIN creative cr ON cr.id = a.creative_id
       LEFT JOIN provider_object_snapshot pc
         ON pc.snapshot_id = ss.id AND pc.object_level = 'campaign' AND pc.external_id = c.external_id
       LEFT JOIN provider_object_snapshot pg
         ON pg.snapshot_id = ss.id AND pg.object_level = 'ad_group' AND pg.external_id = ag.external_id
       LEFT JOIN provider_object_snapshot pa
         ON pa.snapshot_id = ss.id AND pa.object_level = 'ad' AND pa.external_id = a.external_id
       LEFT JOIN provider_object_snapshot pcr
         ON pcr.snapshot_id = ss.id AND pcr.object_level = 'creative' AND pcr.external_id = cr.external_id
       WHERE 1 = 1${campaignSource}
       ORDER BY c.name ASC, ag.name ASC, a.name ASC, cr.name ASC`,
    )
    .bind(...dates.values, ...source.values, ...newerDates.values, ...newerSource.values, ...campaignValues)
    .all<ExplorerRow>();

  const rows = result.results as ExplorerRow[];
  const campaigns = new Map<string, {
    campaignId: string;
    campaignName: string;
    source: string;
    adGroups: Array<{ adGroupId: string; adGroupName: string; ads: Array<{ adId: string; adName: string; creatives: Array<{ creativeId: string; creativeName: string }> }> }>;
  }>();
  let incomplete = false;
  for (const row of rows) {
    const campaign = campaigns.get(row.campaign_id) ?? { campaignId: row.campaign_id, campaignName: row.campaign_name, source: row.source, adGroups: [] };
    campaigns.set(row.campaign_id, campaign);
    if (!row.campaign_snapshot_id || !row.ad_group_id || !row.ad_group_name || !row.ad_group_snapshot_id || !row.ad_id || !row.ad_name || !row.ad_snapshot_id || !row.creative_id || !row.creative_name || !row.creative_snapshot_id) {
      incomplete = true;
      continue;
    }
    let group = campaign.adGroups.find((item) => item.adGroupId === row.ad_group_id);
    if (!group) {
      group = { adGroupId: row.ad_group_id, adGroupName: row.ad_group_name, ads: [] };
      campaign.adGroups.push(group);
    }
    let ad = group.ads.find((item) => item.adId === row.ad_id);
    if (!ad) {
      ad = { adId: row.ad_id, adName: row.ad_name, creatives: [] };
      group.ads.push(ad);
    }
    if (!ad.creatives.some((item) => item.creativeId === row.creative_id)) {
      ad.creatives.push({ creativeId: row.creative_id, creativeName: row.creative_name });
    }
  }
  return { tree: [...campaigns.values()], quality: rows.length === 0 ? "lineage_not_available" : incomplete ? "lineage_incomplete" : "valid" } as const;
}

