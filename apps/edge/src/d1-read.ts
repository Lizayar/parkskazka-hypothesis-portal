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

