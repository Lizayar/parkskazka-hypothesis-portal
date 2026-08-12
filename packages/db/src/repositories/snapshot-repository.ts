import { createHash, randomUUID } from "node:crypto";
import type { Snapshot } from "../schema/ingestion.js";
import type { Source } from "../schema/core.js";

export type SnapshotInput = {
  source: Source;
  accountId: string;
  period: string;
  schemaVersion: string;
  extractionMethod: Snapshot["extractionMethod"];
  payload: string;
  qualityStatus?: Snapshot["qualityStatus"];
};

export interface SnapshotRepository {
  put(input: SnapshotInput): Snapshot;
  list(): readonly Snapshot[];
}

export function contentHash(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export class InMemorySnapshotRepository implements SnapshotRepository {
  private readonly snapshots = new Map<string, Snapshot>();

  put(input: SnapshotInput): Snapshot {
    const hash = contentHash(input.payload);
    const identity = `${input.source}:${input.accountId}:${input.period}:${hash}`;
    const existing = this.snapshots.get(identity);
    if (existing) {
      return { ...existing };
    }

    const snapshot: Snapshot = {
      id: randomUUID(),
      source: input.source,
      accountId: input.accountId,
      period: input.period,
      contentHash: hash,
      schemaVersion: input.schemaVersion,
      rawObjectKey: `snapshots/${input.source}/${input.accountId}/${input.period}/${hash}.json`,
      extractionMethod: input.extractionMethod,
      qualityStatus: input.qualityStatus ?? "valid",
    };
    this.snapshots.set(identity, snapshot);
    return { ...snapshot };
  }

  list(): readonly Snapshot[] {
    return [...this.snapshots.values()].map((snapshot) => ({ ...snapshot }));
  }
}

