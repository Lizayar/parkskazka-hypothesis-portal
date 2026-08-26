import type { ReadOnlyAdsAdapter } from "@portal/adapters/contracts";
import type { Source } from "@portal/db/schema/core";
import type { Snapshot } from "@portal/db/schema/ingestion";
import type { SnapshotRepository } from "@portal/db/repositories/snapshot-repository";
import {
  collectProviderBatch,
  planProviderSnapshot,
  type NormalizedProviderBatch,
} from "./provider-ingestion.js";

export type ExportRunnerRequest = {
  source: Source;
  accountId: string;
  from: string;
  to: string;
  timezone: string;
  schemaVersion: string;
  metricKeys?: readonly string[];
  extractionMethod?: Snapshot["extractionMethod"];
  qualityStatus?: Snapshot["qualityStatus"];
};

export type ExportRunnerResult =
  | {
      status: "completed";
      source: Source;
      accountId: string;
      contentHash: string;
      snapshot: Snapshot;
      rows: number;
    }
  | {
      status: "duplicate";
      source: Source;
      accountId: string;
      contentHash: string;
      snapshot: Snapshot;
      rows: number;
    }
  | {
      status: "unsupported";
      source: Source;
      accountId: string;
      code: "UNSUPPORTED_CAPABILITY";
    }
  | {
      status: "failed";
      source: Source;
      accountId: string;
      code: "INVALID_REQUEST" | "SOURCE_FAILURE";
    };

export type ScheduledExportConfig = Omit<ExportRunnerRequest, "from" | "to"> & {
  backfillDays: number;
};

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildBackfillPeriod(now: Date, backfillDays: number): { from: string; to: string } {
  if (!(now instanceof Date) || Number.isNaN(now.valueOf()) || !Number.isInteger(backfillDays) || backfillDays < 1 || backfillDays > 31) {
    throw new Error("INVALID_BACKFILL_WINDOW");
  }
  const to = isoDate(now);
  const fromDate = new Date(`${to}T00:00:00Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - (backfillDays - 1));
  return { from: isoDate(fromDate), to };
}

function requestValid(request: ExportRunnerRequest): boolean {
  return Boolean(
    request.accountId.trim() &&
      request.timezone.trim() &&
      request.schemaVersion.trim() &&
      validDate(request.from) &&
      validDate(request.to) &&
      request.from <= request.to,
  );
}

function failureCode(error: unknown): "UNSUPPORTED_CAPABILITY" | "SOURCE_FAILURE" {
  return error instanceof Error && error.message === "UNSUPPORTED_CAPABILITY" ? "UNSUPPORTED_CAPABILITY" : "SOURCE_FAILURE";
}

export function createReadOnlyExportRunner(dependencies: {
  adapters: ReadonlyMap<Source, ReadOnlyAdsAdapter>;
  snapshotRepository: SnapshotRepository;
}) {
  async function collect(request: ExportRunnerRequest): Promise<{ batch: NormalizedProviderBatch; contentHash: string }> {
    const adapter = dependencies.adapters.get(request.source);
    if (!adapter || adapter.source !== request.source) throw new Error("UNSUPPORTED_CAPABILITY");
    const batch = await collectProviderBatch({ adapter, ...request });
    const existingHashes = new Set(dependencies.snapshotRepository.list().map((snapshot) => snapshot.contentHash));
    const plan = planProviderSnapshot(batch, existingHashes);
    return { batch, contentHash: plan.contentHash };
  }

  return {
    async run(request: ExportRunnerRequest): Promise<ExportRunnerResult> {
      if (!requestValid(request)) return { status: "failed", source: request.source, accountId: request.accountId, code: "INVALID_REQUEST" };
      try {
        const adapter = dependencies.adapters.get(request.source);
        if (!adapter) return { status: "unsupported", source: request.source, accountId: request.accountId, code: "UNSUPPORTED_CAPABILITY" };
        const batch = await collectProviderBatch({ adapter, ...request });
        const existing = dependencies.snapshotRepository.list();
        const plan = planProviderSnapshot(batch, new Set(existing.map((snapshot) => snapshot.contentHash)));
        const duplicate = existing.find((snapshot) => snapshot.contentHash === plan.contentHash);
        if (duplicate) {
          return { status: "duplicate", source: request.source, accountId: request.accountId, contentHash: plan.contentHash, snapshot: duplicate, rows: batch.rows.length };
        }
        const snapshot = dependencies.snapshotRepository.put(plan.snapshotInput);
        return { status: "completed", source: request.source, accountId: request.accountId, contentHash: plan.contentHash, snapshot, rows: batch.rows.length };
      } catch (error) {
        const code = failureCode(error);
        if (code === "UNSUPPORTED_CAPABILITY") return { status: "unsupported", source: request.source, accountId: request.accountId, code };
        return { status: "failed", source: request.source, accountId: request.accountId, code };
      }
    },

    async runScheduled(configs: readonly ScheduledExportConfig[], now = new Date()): Promise<readonly ExportRunnerResult[]> {
      const results: ExportRunnerResult[] = [];
      for (const config of configs) {
        try {
          const period = buildBackfillPeriod(now, config.backfillDays);
          results.push(await this.run({ ...config, ...period }));
        } catch {
          results.push({ status: "failed", source: config.source, accountId: config.accountId, code: "INVALID_REQUEST" });
        }
      }
      return results;
    },

    // Kept as an explicit read-only preparation hook for a future D1 statement executor.
    async prepare(request: ExportRunnerRequest): Promise<{ batch: NormalizedProviderBatch; contentHash: string }> {
      if (!requestValid(request)) throw new Error("INVALID_REQUEST");
      return collect(request);
    },
  };
}

