import type { NormalizedProviderBatch, NormalizedProviderRow } from "./provider-ingestion.js";

export type ReconciliationMetric = "spend" | "impressions" | "clicks" | "sessions" | "leads";
export type ReconciliationReference = Readonly<Partial<Record<ReconciliationMetric, number>>>;

export type ReconciliationMetricResult = {
  metric: ReconciliationMetric;
  observed: number | null;
  expected: number;
  delta: number | null;
  relativeDelta: number | null;
  status: "matched" | "mismatch" | "not_observed";
};

export type ReconciliationResult = {
  source: NormalizedProviderBatch["source"];
  accountId: string;
  period: { from: string; to: string };
  status: "matched" | "partial" | "mismatch" | "not_comparable";
  metrics: readonly ReconciliationMetricResult[];
};

const METRICS: readonly ReconciliationMetric[] = ["spend", "impressions", "clicks", "sessions", "leads"];
const DEFAULT_ABSOLUTE_TOLERANCE = 0.01;
const DEFAULT_RELATIVE_TOLERANCE = 0.005;

function metricSum(rows: readonly NormalizedProviderRow[], metric: ReconciliationMetric): number | null {
  let found = false;
  let total = 0;
  for (const row of rows) {
    const value = row.metricValues?.[metric];
    if (value === undefined) continue;
    found = true;
    total += value;
  }
  return found ? total : null;
}

export function reconcileNormalizedBatch(
  batch: NormalizedProviderBatch,
  expected: ReconciliationReference,
  options: { absoluteTolerance?: number; relativeTolerance?: number } = {},
): ReconciliationResult {
  const absoluteTolerance = options.absoluteTolerance ?? DEFAULT_ABSOLUTE_TOLERANCE;
  const relativeTolerance = options.relativeTolerance ?? DEFAULT_RELATIVE_TOLERANCE;
  if (!Number.isFinite(absoluteTolerance) || absoluteTolerance < 0 || !Number.isFinite(relativeTolerance) || relativeTolerance < 0) {
    throw new Error("INVALID_RECONCILIATION_TOLERANCE");
  }
  const comparableMetrics = METRICS.filter((metric) => expected[metric] !== undefined);
  if (comparableMetrics.length === 0) {
    return { source: batch.source, accountId: batch.accountId, period: { from: batch.from, to: batch.to }, status: "not_comparable", metrics: [] };
  }
  const metrics = comparableMetrics.map((metric): ReconciliationMetricResult => {
    const expectedValue = expected[metric] as number;
    if (!Number.isFinite(expectedValue) || expectedValue < 0) throw new Error("INVALID_REFERENCE_VALUE");
    const observed = metricSum(batch.rows, metric);
    if (observed === null) return { metric, observed: null, expected: expectedValue, delta: null, relativeDelta: null, status: "not_observed" };
    const delta = observed - expectedValue;
    const relativeDelta = expectedValue === 0 ? Math.abs(delta) : Math.abs(delta) / Math.abs(expectedValue);
    const status = Math.abs(delta) <= absoluteTolerance || relativeDelta <= relativeTolerance ? "matched" : "mismatch";
    return { metric, observed, expected: expectedValue, delta, relativeDelta, status };
  });
  const mismatch = metrics.some((metric) => metric.status === "mismatch");
  const notObserved = metrics.some((metric) => metric.status === "not_observed");
  return { source: batch.source, accountId: batch.accountId, period: { from: batch.from, to: batch.to }, status: mismatch ? "mismatch" : notObserved ? "partial" : "matched", metrics };
}

