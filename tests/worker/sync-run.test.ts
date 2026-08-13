import { describe, expect, it } from "vitest";
import { InMemorySnapshotRepository } from "@portal/db/repositories/snapshot-repository";
import { createSyncRunService } from "@portal/worker/jobs/sync-run";

function adapterWithPayload(payload: string) {
  return {
    source: "vk_ads" as const,
    discoverCapabilities: async () => ({
      source: "vk_ads" as const,
      supported: true,
      objectLevels: ["campaign"] as const,
      metrics: ["impressions"] as const,
    }),
    async *listObjects() {
      yield {
        page: 1,
        hasNextPage: false,
        rows: [{ externalId: "campaign-1", payload }],
      };
    },
    async *getStats() {
      yield { page: 1, hasNextPage: false, rows: [] };
    },
  };
}

describe("idempotent sync-run service", () => {
  it("does not duplicate a snapshot on retry", async () => {
    const snapshots = new InMemorySnapshotRepository();
    const service = createSyncRunService({ snapshotRepository: snapshots });
    const request = {
      source: "vk_ads" as const,
      accountId: "account-1",
      from: "2026-08-12",
      to: "2026-08-12",
      timezone: "Europe/Moscow",
      schemaVersion: "vk.v1",
      adapter: adapterWithPayload("same-payload"),
    };

    const first = await service.execute(request);
    const second = await service.execute(request);

    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    expect(second.logicalFactSetId).toBe(first.logicalFactSetId);
    expect(snapshots.list()).toHaveLength(1);
  });

  it("creates a new content-addressed snapshot when payload changes", async () => {
    const snapshots = new InMemorySnapshotRepository();
    const service = createSyncRunService({ snapshotRepository: snapshots });
    const base = {
      source: "vk_ads" as const,
      accountId: "account-1",
      from: "2026-08-12",
      to: "2026-08-12",
      timezone: "Europe/Moscow",
      schemaVersion: "vk.v1",
    };

    const first = await service.execute({ ...base, adapter: adapterWithPayload("payload-a") });
    const second = await service.execute({ ...base, adapter: adapterWithPayload("payload-b") });

    expect(second.logicalFactSetId).not.toBe(first.logicalFactSetId);
    expect(snapshots.list()).toHaveLength(2);
  });

  it("returns partial when a source capability is unsupported", async () => {
    const snapshots = new InMemorySnapshotRepository();
    const service = createSyncRunService({ snapshotRepository: snapshots });
    const adapter = {
      source: "telegram_ads" as const,
      discoverCapabilities: async () => ({
        source: "telegram_ads" as const,
        supported: false,
        objectLevels: [],
        metrics: [],
      }),
      async *listObjects() {
        yield { page: 1, hasNextPage: false, rows: [] };
      },
      async *getStats() {
        yield { page: 1, hasNextPage: false, rows: [] };
      },
    };

    const result = await service.execute({
      source: "telegram_ads",
      accountId: "account-telegram",
      from: "2026-08-12",
      to: "2026-08-12",
      timezone: "Europe/Moscow",
      schemaVersion: "telegram.v1",
      adapter,
    });

    expect(result).toMatchObject({ status: "partial", code: "UNSUPPORTED_CAPABILITY" });
    expect(snapshots.list()).toHaveLength(0);
  });
});

