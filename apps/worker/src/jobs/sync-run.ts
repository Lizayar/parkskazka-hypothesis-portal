import type { ReadOnlyAdsAdapter } from "@portal/adapters/contracts";
import { AdapterError } from "@portal/adapters/errors";
import type { Source } from "@portal/db/schema/core";
import type { Snapshot } from "@portal/db/schema/ingestion";
import type {
  SnapshotInput,
  SnapshotRepository,
} from "@portal/db/repositories/snapshot-repository";
import {
  InMemorySyncRunRepository,
  type SyncRunRepository,
} from "@portal/db/repositories/sync-run-repository";
import { serializePages } from "./normalize-snapshot.js";
import { evaluateSnapshotQuality } from "./quality-check.js";

export type SyncRequest = {
  source: Source;
  accountId: string;
  from: string;
  to: string;
  timezone: string;
  schemaVersion: string;
  extractionMethod?: Snapshot["extractionMethod"];
  adapter: ReadOnlyAdsAdapter;
};

export type SyncResult =
  | {
      status: "completed";
      runId: string;
      logicalFactSetId: string;
      snapshot: Snapshot;
    }
  | {
      status: "partial";
      runId: string;
      code: "UNSUPPORTED_CAPABILITY";
      warnings: readonly string[];
      logicalFactSetId?: undefined;
    }
  | {
      status: "failed";
      runId: string;
      code: AdapterError["code"];
      warnings: readonly string[];
      logicalFactSetId?: undefined;
    };

type SyncDependencies = {
  snapshotRepository: SnapshotRepository;
  syncRunRepository?: SyncRunRepository;
};

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

function validDateRange(from: string, to: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
}

export function createSyncRunService(dependencies: SyncDependencies) {
  const syncRuns = dependencies.syncRunRepository ?? new InMemorySyncRunRepository();

  return {
    async execute(request: SyncRequest): Promise<SyncResult> {
      const run = syncRuns.start({
        source: request.source,
        accountId: request.accountId,
        requestedFrom: request.from,
        requestedTo: request.to,
      });

      if (!validDateRange(request.from, request.to)) {
        syncRuns.finish(run.id, { status: "failed", snapshotIds: [] });
        return { status: "failed", runId: run.id, code: "INVALID_PERIOD", warnings: ["period_invalid"] };
      }
      if (!request.timezone.trim()) {
        syncRuns.finish(run.id, { status: "failed", snapshotIds: [] });
        return { status: "failed", runId: run.id, code: "INVALID_TIMEZONE", warnings: ["timezone_missing"] };
      }
      if (!request.schemaVersion.trim()) {
        syncRuns.finish(run.id, { status: "failed", snapshotIds: [] });
        return { status: "failed", runId: run.id, code: "INVALID_SCHEMA", warnings: ["schema_version_missing"] };
      }

      let capabilities;
      try {
        capabilities = await request.adapter.discoverCapabilities();
      } catch {
        syncRuns.finish(run.id, { status: "failed", snapshotIds: [] });
        return { status: "failed", runId: run.id, code: "SOURCE_FAILURE", warnings: ["capability_discovery_failed"] };
      }
      if (!capabilities.supported) {
        syncRuns.finish(run.id, { status: "partial", snapshotIds: [] });
        return {
          status: "partial",
          runId: run.id,
          code: "UNSUPPORTED_CAPABILITY",
          warnings: [capabilities.reason ?? "source_unsupported"],
        };
      }

      try {
        const pages = await collect(
          request.adapter.listObjects({
            accountId: request.accountId,
            from: request.from,
            to: request.to,
            timezone: request.timezone,
          }),
        );
        const payload = serializePages(pages);
        const quality = evaluateSnapshotQuality({
          rowCount: pages.reduce((total, page) => total + page.rows.length, 0),
          hasPeriod: true,
          hasSchema: true,
        });
        const input: SnapshotInput = {
          source: request.source,
          accountId: request.accountId,
          period: `${request.from}/${request.to}`,
          schemaVersion: request.schemaVersion,
          extractionMethod: request.extractionMethod ?? "api",
          payload,
          qualityStatus: quality.status,
        };
        const snapshot = dependencies.snapshotRepository.put(input);
        syncRuns.finish(run.id, { status: "completed", snapshotIds: [snapshot.id] });
        return {
          status: "completed",
          runId: run.id,
          logicalFactSetId: snapshot.id,
          snapshot,
        };
      } catch {
        syncRuns.finish(run.id, { status: "failed", snapshotIds: [] });
        return { status: "failed", runId: run.id, code: "SOURCE_FAILURE", warnings: ["source_read_failed"] };
      }
    },
  };
}

