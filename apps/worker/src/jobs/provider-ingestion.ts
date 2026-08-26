import { createHash } from "node:crypto";
import type { AdapterPage, ReadOnlyAdsAdapter } from "@portal/adapters/contracts";
import { objectLevels, sources, type ObjectLevel, type Source } from "@portal/db/schema/core";
import type { SnapshotInput } from "@portal/db/repositories/snapshot-repository";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_ID_RE = /^[A-Za-z0-9._:-]{1,256}$/;
const SECRET_KEY_RE = /(password|secret|token|authorization|api[_-]?key|access[_-]?key)/i;
const SECRET_VALUE_RE = /(bearer\s+|postgres(?:ql)?):\/\//i;
const METRIC_KEYS = new Set(["spend", "impressions", "clicks", "sessions", "leads", "conversions"]);

export type NormalizedMetricValues = Readonly<Record<string, number>>;

export type NormalizedProviderRow = {
  source: Source;
  objectLevel: ObjectLevel;
  externalId: string;
  name: string;
  parentExternalId?: string;
  campaignExternalId?: string;
  adGroupExternalId?: string;
  adExternalId?: string;
  channelExternalId?: string;
  contentHash?: string;
  date?: string;
  metricValues?: NormalizedMetricValues;
};

export type NormalizedProviderBatch = {
  source: Source;
  accountId: string;
  from: string;
  to: string;
  schemaVersion: string;
  extractionMethod: SnapshotInput["extractionMethod"];
  qualityStatus?: SnapshotInput["qualityStatus"];
  rows: readonly NormalizedProviderRow[];
};

export type D1WriteStatement = {
  sql: string;
  bindings: readonly (string | number | null)[];
};

export type PlannedProviderSnapshot = {
  action: "insert" | "skip_duplicate";
  contentHash: string;
  snapshotId: string;
  snapshotInput: SnapshotInput;
  rows: readonly NormalizedProviderRow[];
};

function isSource(value: string): value is Source {
  return (sources as readonly string[]).includes(value);
}

function isObjectLevel(value: string): value is ObjectLevel {
  return (objectLevels as readonly string[]).includes(value);
}

function validDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function assertSafeText(value: string, label: string, maxLength: number): void {
  if (!value || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`INVALID_${label.toUpperCase()}`);
  }
  if (SECRET_VALUE_RE.test(value)) throw new Error("SECRET_LIKE_VALUE");
}

function assertNoSecrets(value: unknown, key = "root"): void {
  if (typeof value === "string") {
    if (SECRET_VALUE_RE.test(value)) throw new Error("SECRET_LIKE_VALUE");
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) assertNoSecrets(item, key);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [childKey, childValue] of Object.entries(value)) {
    if (SECRET_KEY_RE.test(childKey)) throw new Error("SECRET_FIELD");
    assertNoSecrets(childValue, childKey);
  }
}

function canonicalMetricValues(values: unknown): NormalizedMetricValues | undefined {
  if (!values || typeof values !== "object" || Array.isArray(values)) return undefined;
  const result: Record<string, number> = {};
  for (const key of Object.keys(values).sort()) {
    const value = (values as Record<string, unknown>)[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("INVALID_METRIC_VALUE");
    result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

function optionalId(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !SAFE_ID_RE.test(value)) throw new Error(`INVALID_${label.toUpperCase()}`);
  return value;
}

function rawMetricValues(row: Record<string, unknown>): NormalizedMetricValues | undefined {
  const nested = canonicalMetricValues(row.metrics);
  const direct: Record<string, number> = {};
  for (const key of METRIC_KEYS) {
    const value = row[key];
    if (value !== undefined) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("INVALID_METRIC_VALUE");
      direct[key] = value;
    }
  }
  return canonicalMetricValues({ ...(nested ?? {}), ...direct });
}

export function normalizeProviderRow(source: Source, input: Readonly<Record<string, unknown>>): NormalizedProviderRow {
  assertNoSecrets(input);
  const objectLevel = input.objectLevel;
  const externalId = input.externalId;
  if (typeof objectLevel !== "string" || !isObjectLevel(objectLevel)) throw new Error("INVALID_OBJECT_LEVEL");
  if (typeof externalId !== "string" || !SAFE_ID_RE.test(externalId)) throw new Error("INVALID_EXTERNAL_ID");
  const name = typeof input.name === "string" && input.name.trim() ? input.name : externalId;
  assertSafeText(name, "name", 512);

  const contentHash = optionalId(input.contentHash, "content_hash");
  if (contentHash && !/^[a-f0-9]{64}$/i.test(contentHash)) throw new Error("INVALID_CONTENT_HASH");
  const date = typeof input.date === "string" ? input.date : undefined;
  if (date && !validDate(date)) throw new Error("INVALID_ROW_DATE");

  const normalized: NormalizedProviderRow = {
    source,
    objectLevel,
    externalId,
    name,
    parentExternalId: optionalId(input.parentExternalId, "parent_external_id"),
    campaignExternalId: optionalId(input.campaignExternalId, "campaign_external_id"),
    adGroupExternalId: optionalId(input.adGroupExternalId, "ad_group_external_id"),
    adExternalId: optionalId(input.adExternalId, "ad_external_id"),
    channelExternalId: optionalId(input.channelExternalId, "channel_external_id"),
    contentHash,
    date,
    metricValues: rawMetricValues(input),
  };
  return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined)) as NormalizedProviderRow;
}

function rowKey(row: NormalizedProviderRow): string {
  return `${row.objectLevel}:${row.externalId}`;
}

function canonicalRow(row: NormalizedProviderRow): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function validateNormalizedBatch(batch: NormalizedProviderBatch): void {
  if (!isSource(batch.source)) throw new Error("INVALID_SOURCE");
  if (!SAFE_ID_RE.test(batch.accountId)) throw new Error("INVALID_ACCOUNT_ID");
  if (!validDate(batch.from) || !validDate(batch.to) || batch.from > batch.to) throw new Error("INVALID_PERIOD");
  assertSafeText(batch.schemaVersion, "schema_version", 128);
  if (batch.rows.length > 10_000) throw new Error("TOO_MANY_ROWS");
  const seen = new Set<string>();
  for (const row of batch.rows) {
    if (row.source !== batch.source) throw new Error("SOURCE_MISMATCH");
    const key = rowKey(row);
    if (seen.has(key)) throw new Error("DUPLICATE_OBJECT");
    seen.add(key);
    if (row.date && (row.date < batch.from || row.date > batch.to)) throw new Error("ROW_OUTSIDE_PERIOD");
  }
}

export function canonicalizeBatch(batch: NormalizedProviderBatch): string {
  validateNormalizedBatch(batch);
  return JSON.stringify({
    source: batch.source,
    accountId: batch.accountId,
    from: batch.from,
    to: batch.to,
    schemaVersion: batch.schemaVersion,
    extractionMethod: batch.extractionMethod,
    qualityStatus: batch.qualityStatus ?? "valid",
    rows: [...batch.rows].sort((left, right) => rowKey(left).localeCompare(rowKey(right))).map(canonicalRow),
  });
}

export function hashNormalizedBatch(batch: NormalizedProviderBatch): string {
  return createHash("sha256").update(canonicalizeBatch(batch), "utf8").digest("hex");
}

export function planProviderSnapshot(
  batch: NormalizedProviderBatch,
  existingHashes: ReadonlySet<string> = new Set(),
): PlannedProviderSnapshot {
  const payload = canonicalizeBatch(batch);
  const contentHash = createHash("sha256").update(payload, "utf8").digest("hex");
  const snapshotId = `snapshot-${contentHash.slice(0, 32)}`;
  const snapshotInput: SnapshotInput = {
    source: batch.source,
    accountId: batch.accountId,
    period: `${batch.from}/${batch.to}`,
    schemaVersion: batch.schemaVersion,
    extractionMethod: batch.extractionMethod,
    payload,
    qualityStatus: batch.qualityStatus ?? "valid",
  };
  return {
    action: existingHashes.has(contentHash) ? "skip_duplicate" : "insert",
    contentHash,
    snapshotId,
    snapshotInput,
    rows: batch.rows,
  };
}

export function toD1WriteStatements(
  plan: PlannedProviderSnapshot,
  fetchedAt = "1970-01-01T00:00:00.000Z",
): readonly D1WriteStatement[] {
  if (plan.action === "skip_duplicate") return [];
  const [periodFrom, periodTo] = plan.snapshotInput.period.split("/");
  const statements: D1WriteStatement[] = [
    {
      sql: "INSERT OR IGNORE INTO source_snapshot (id, source, account_id, period_from, period_to, content_hash, schema_version, extraction_method, quality_status, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      bindings: [
        plan.snapshotId,
        plan.snapshotInput.source,
        plan.snapshotInput.accountId,
        periodFrom ?? null,
        periodTo ?? null,
        plan.contentHash,
        plan.snapshotInput.schemaVersion,
        plan.snapshotInput.extractionMethod,
        plan.snapshotInput.qualityStatus ?? "valid",
        fetchedAt,
      ],
    },
  ];
  for (const row of plan.rows) {
    statements.push({
      sql: "INSERT OR IGNORE INTO provider_object_snapshot (snapshot_id, source, account_id, object_level, external_id, name, parent_external_id, campaign_external_id, ad_group_external_id, ad_external_id, channel_external_id, content_hash, row_date, metric_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      bindings: [
        plan.snapshotId,
        row.source,
        plan.snapshotInput.accountId,
        row.objectLevel,
        row.externalId,
        row.name,
        row.parentExternalId ?? null,
        row.campaignExternalId ?? null,
        row.adGroupExternalId ?? null,
        row.adExternalId ?? null,
        row.channelExternalId ?? null,
        row.contentHash ?? null,
        row.date ?? null,
        row.metricValues ? JSON.stringify(row.metricValues) : null,
      ],
    });
  }
  return statements;
}

async function collectPages(iterable: AsyncIterable<AdapterPage>): Promise<AdapterPage[]> {
  const pages: AdapterPage[] = [];
  for await (const page of iterable) pages.push(page);
  return pages;
}

export async function collectProviderBatch(input: {
  adapter: ReadOnlyAdsAdapter;
  accountId: string;
  from: string;
  to: string;
  timezone: string;
  schemaVersion: string;
  metricKeys?: readonly string[];
  extractionMethod?: SnapshotInput["extractionMethod"];
  qualityStatus?: SnapshotInput["qualityStatus"];
}): Promise<NormalizedProviderBatch> {
  const capabilities = await input.adapter.discoverCapabilities();
  if (!capabilities.supported) throw new Error("UNSUPPORTED_CAPABILITY");
  const listPages = await collectPages(
    input.adapter.listObjects({ accountId: input.accountId, from: input.from, to: input.to, timezone: input.timezone }),
  );
  const statsPages = await collectPages(
    input.adapter.getStats({
      accountId: input.accountId,
      from: input.from,
      to: input.to,
      timezone: input.timezone,
      metricKeys: input.metricKeys ?? capabilities.metrics,
    }),
  );
  const merged = new Map<string, NormalizedProviderRow>();
  for (const page of [...listPages, ...statsPages]) {
    for (const rawRow of page.rows) {
      const row = normalizeProviderRow(input.adapter.source, rawRow);
      const key = rowKey(row);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, row);
        continue;
      }
      merged.set(key, {
        ...existing,
        metricValues: canonicalMetricValues({ ...(existing.metricValues ?? {}), ...(row.metricValues ?? {}) }),
        date: existing.date ?? row.date,
        contentHash: existing.contentHash ?? row.contentHash,
      });
    }
  }
  const batch: NormalizedProviderBatch = {
    source: input.adapter.source,
    accountId: input.accountId,
    from: input.from,
    to: input.to,
    schemaVersion: input.schemaVersion,
    extractionMethod: input.extractionMethod ?? capabilities.extractionMethod ?? "api",
    qualityStatus: input.qualityStatus,
    rows: [...merged.values()],
  };
  validateNormalizedBatch(batch);
  return batch;
}

