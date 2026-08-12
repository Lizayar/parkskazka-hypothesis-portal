import { randomUUID } from "node:crypto";
import type { Source } from "../schema/core.js";
import type { SyncRun } from "../schema/ingestion.js";

export type SyncRunInput = Pick<SyncRun, "source" | "accountId" | "requestedFrom" | "requestedTo">;

export interface SyncRunRepository {
  start(input: SyncRunInput): SyncRun;
  finish(id: string, update: Pick<SyncRun, "status" | "snapshotIds">): SyncRun;
  list(): readonly SyncRun[];
}

export class InMemorySyncRunRepository implements SyncRunRepository {
  private readonly runs = new Map<string, SyncRun>();

  start(input: SyncRunInput): SyncRun {
    const run: SyncRun = {
      id: randomUUID(),
      source: input.source,
      accountId: input.accountId,
      requestedFrom: input.requestedFrom,
      requestedTo: input.requestedTo,
      status: "running",
      snapshotIds: [],
      startedAt: new Date().toISOString(),
    };
    this.runs.set(run.id, run);
    return { ...run };
  }

  finish(id: string, update: Pick<SyncRun, "status" | "snapshotIds">): SyncRun {
    const current = this.runs.get(id);
    if (!current) throw new Error("SYNC_RUN_NOT_FOUND");
    const run: SyncRun = {
      ...current,
      status: update.status,
      snapshotIds: [...update.snapshotIds],
      finishedAt: new Date().toISOString(),
    };
    this.runs.set(id, run);
    return { ...run, snapshotIds: [...run.snapshotIds] };
  }

  list(): readonly SyncRun[] {
    return [...this.runs.values()].map((run) => ({ ...run, snapshotIds: [...run.snapshotIds] }));
  }
}

