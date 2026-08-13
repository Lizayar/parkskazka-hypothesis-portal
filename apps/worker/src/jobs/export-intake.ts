import type { Source } from "@portal/db/schema/core";
import {
  normalizeProviderRow,
  validateNormalizedBatch,
  type NormalizedProviderBatch,
  type NormalizedProviderRow,
} from "./provider-ingestion.js";

export type ReadOnlyExportEnvelope<T> = {
  source: Source;
  accountId: string;
  from: string;
  to: string;
  schemaVersion: string;
  extractionMethod: NormalizedProviderBatch["extractionMethod"];
  rows: readonly T[];
};

export type ExportRowMapper<T> = (row: T, index: number) => Readonly<Record<string, unknown>>;

const MAX_JSON_BYTES = 5 * 1024 * 1024;
const SECRET_KEY_RE = /(password|secret|token|authorization|api[_-]?key|access[_-]?key)/i;
const SECRET_VALUE_RE = /(bearer\s+|postgres(?:ql)?):\/\//i;

function assertNoSecretFields(value: unknown): void {
  if (typeof value === "string") {
    if (SECRET_VALUE_RE.test(value)) throw new Error("SECRET_LIKE_VALUE");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(assertNoSecretFields);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEY_RE.test(key)) throw new Error("SECRET_FIELD");
    assertNoSecretFields(child);
  }
}

function assertEnvelope(input: unknown): asserts input is ReadOnlyExportEnvelope<unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVALID_EXPORT_ENVELOPE");
  const envelope = input as Record<string, unknown>;
  if (typeof envelope.source !== "string" || typeof envelope.accountId !== "string" || typeof envelope.from !== "string" || typeof envelope.to !== "string" || typeof envelope.schemaVersion !== "string" || typeof envelope.extractionMethod !== "string" || !Array.isArray(envelope.rows)) {
    throw new Error("INVALID_EXPORT_ENVELOPE");
  }
  if (envelope.rows.length > 10_000) throw new Error("TOO_MANY_EXPORT_ROWS");
}

export function createReadOnlyExportIntake<T>(source: Source, mapRow: ExportRowMapper<T>) {
  return {
    accept(input: ReadOnlyExportEnvelope<T>): NormalizedProviderBatch {
      assertEnvelope(input);
      if (input.source !== source) throw new Error("SOURCE_MISMATCH");
      assertNoSecretFields(input);
      const rows: NormalizedProviderRow[] = input.rows.map((row, index) => normalizeProviderRow(source, mapRow(row, index)));
      const batch: NormalizedProviderBatch = { ...input, rows };
      validateNormalizedBatch(batch);
      return batch;
    },
    acceptJson(json: string): NormalizedProviderBatch {
      if (typeof json !== "string" || new TextEncoder().encode(json).byteLength > MAX_JSON_BYTES) throw new Error("EXPORT_JSON_TOO_LARGE");
      let input: unknown;
      try {
        input = JSON.parse(json);
      } catch {
        throw new Error("INVALID_EXPORT_JSON");
      }
      return this.accept(input as ReadOnlyExportEnvelope<T>);
    },
  };
}

