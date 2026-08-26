export type MetricKind = "platform" | "site_conversion" | "derived";

export type MetricDefinition = {
  key: string;
  kind: MetricKind;
  numerator: string;
  denominator: string | null;
  source: "vk_ads" | "yandex_metrica" | "avito_ads" | "telegram_ads" | "derived";
  unit: "currency" | "count" | "ratio";
};

const definitions: Record<string, MetricDefinition> = {
  "vk_ads.spend": {
    key: "vk_ads.spend",
    kind: "platform",
    numerator: "spend",
    denominator: null,
    source: "vk_ads",
    unit: "currency",
  },
  "yandex_metrica.goal.lead": {
    key: "yandex_metrica.goal.lead",
    kind: "site_conversion",
    numerator: "goal_completions",
    denominator: null,
    source: "yandex_metrica",
    unit: "count",
  },
  "derived.cpl": {
    key: "derived.cpl",
    kind: "derived",
    numerator: "spend",
    denominator: "goal.lead",
    source: "derived",
    unit: "currency",
  },
};

export function metricDefinition(key: string): MetricDefinition {
  const definition = definitions[key];
  if (!definition) {
    throw new Error("UNKNOWN_METRIC");
  }
  return { ...definition };
}

export type DateRange = {
  from: string;
  to: string;
  timezone: string;
};

export type DateRangeComparison = {
  current: DateRange;
  previous: DateRange;
  timezone: string;
  attributionModel: string;
  comparable: boolean;
  reasons: readonly string[];
};

function validRange(range: DateRange): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(range.from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(range.to) &&
    range.from <= range.to && Boolean(range.timezone.trim());
}

export function compareDateRanges(
  current: DateRange,
  previous: DateRange,
  attributionModel: string,
): DateRangeComparison {
  const reasons: string[] = [];
  if (!validRange(current) || !validRange(previous)) reasons.push("INVALID_DATE_RANGE");
  if (current.timezone !== previous.timezone) reasons.push("TIMEZONE_MISMATCH");
  if (!attributionModel.trim()) reasons.push("ATTRIBUTION_MODEL_MISSING");
  return {
    current: { ...current },
    previous: { ...previous },
    timezone: current.timezone,
    attributionModel,
    comparable: reasons.length === 0,
    reasons,
  };
}

export type UTM = {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
};

export type MetricaUTMRow = UTM & {
  sessions: number;
  goals: number;
};

export type UTMJoinResult = {
  verdict: "matched" | "unmatched" | "ambiguous";
  sessions: number | null;
  goals: number | null;
  matchedRows: number;
  reason: string;
};

function sameUtm(left: UTM, right: UTM): boolean {
  return left.source === right.source &&
    left.medium === right.medium &&
    left.campaign === right.campaign &&
    (left.content === undefined || right.content === undefined || left.content === right.content);
}

export function joinUtmToMetrica(utm: UTM, rows: readonly MetricaUTMRow[]): UTMJoinResult {
  const matches = rows.filter((row) => sameUtm(utm, row));
  if (matches.length === 0) {
    return { verdict: "unmatched", sessions: null, goals: null, matchedRows: 0, reason: "NO_EXACT_UTM_MATCH" };
  }
  if (matches.length > 1) {
    return { verdict: "ambiguous", sessions: null, goals: null, matchedRows: matches.length, reason: "MULTIPLE_UTM_MATCHES" };
  }
  return {
    verdict: "matched",
    sessions: matches[0].sessions,
    goals: matches[0].goals,
    matchedRows: 1,
    reason: "EXACT_UTM_MATCH",
  };
}

export type MeasurementGateInput = {
  quality: "valid" | "partial" | "invalid";
  maturity: "insufficient" | "mature";
  controlValid: boolean;
  guardrailsClear: boolean;
};

export type MeasurementGateResult = {
  decision: "eligible" | "blocked";
  reasons: readonly string[];
};

export function evaluateMeasurementGate(input: MeasurementGateInput): MeasurementGateResult {
  const reasons: string[] = [];
  if (input.quality !== "valid") reasons.push("QUALITY_NOT_VALID");
  if (input.maturity !== "mature") reasons.push("INSUFFICIENT_MATURITY");
  if (!input.controlValid) reasons.push("CONTROL_INVALID");
  if (!input.guardrailsClear) reasons.push("GUARDRAIL_BREACH");
  return { decision: reasons.length === 0 ? "eligible" : "blocked", reasons };
}

