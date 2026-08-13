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
export type CsvExportMetadata = Omit<ReadOnlyExportEnvelope<unknown>, "rows">;

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

export function parseCsvRecords(csv: string): readonly Readonly<Record<string, string>>[] {
  if (typeof csv !== "string" || new TextEncoder().encode(csv).byteLength > MAX_JSON_BYTES) throw new Error("EXPORT_CSV_TOO_LARGE");
  const text = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let quoteClosed = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (quoteClosed) {
      if (char === ",") {
        row.push(field);
        field = "";
        quoteClosed = false;
      } else if (char === "\r" || char === "\n") {
        row.push(field);
        field = "";
        quoteClosed = false;
        if (char === "\r" && text[index + 1] === "\n") index += 1;
        records.push(row);
        row = [];
      } else if (char.trim() !== "") {
        throw new Error("INVALID_CSV_QUOTE");
      }
      continue;
    }
    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r" || char === "\n") {
      row.push(field);
      field = "";
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      records.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("UNCLOSED_CSV_QUOTE");
  if (quoteClosed || field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  if (records.length === 0 || records[0]?.every((header) => header.trim() === "")) throw new Error("INVALID_CSV_HEADER");
  const headers = records[0]!.map((header) => header.trim());
  if (headers.some((header) => header === "") || new Set(headers).size !== headers.length) throw new Error("INVALID_CSV_HEADER");
  const data = records.slice(1).filter((record) => record.some((value) => value !== ""));
  if (data.length > 10_000) throw new Error("TOO_MANY_EXPORT_ROWS");
  return data.map((values) => {
    if (values.length !== headers.length) throw new Error("INVALID_CSV_ROW");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
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
    acceptCsv(csv: string, metadata: CsvExportMetadata, mapCsvRow: ExportRowMapper<Record<string, string>>): NormalizedProviderBatch {
      const rows = parseCsvRecords(csv);
      return this.accept({ ...metadata, source, rows: rows.map((row, index) => mapCsvRow(row, index)) } as ReadOnlyExportEnvelope<T>);
    },
  };
}

