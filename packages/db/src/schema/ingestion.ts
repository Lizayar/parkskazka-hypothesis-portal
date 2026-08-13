import type { Source } from "./core.js";

export type Snapshot = {
  id: string;
  source: Source;
  accountId: string;
  period: string;
  contentHash: string;
  schemaVersion: string;
  rawObjectKey: string;
  extractionMethod: "api" | "browser_export" | "file_import";
  qualityStatus: "valid" | "partial" | "needs_attention" | "invalid";
};

export type SyncRun = {
  id: string;
  source: Source;
  accountId: string;
  requestedFrom: string;
  requestedTo: string;
  status: "queued" | "running" | "completed" | "partial" | "failed";
  snapshotIds: readonly string[];
  startedAt?: string;
  finishedAt?: string;
};

export type MeasurementRun = {
  id: string;
  testId: string;
  period: string;
  status: "queued" | "running" | "completed" | "blocked";
  calculationVersion: string;
};

