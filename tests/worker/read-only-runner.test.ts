import { describe, expect, it } from "vitest";
import { InMemorySnapshotRepository } from "@portal/db/repositories/snapshot-repository";
import { buildBackfillPeriod, createReadOnlyExportRunner } from "@portal/worker/jobs/read-only-runner";

function adapter(source: "vk_ads" | "telegram_ads" = "vk_ads") {
  return {
    source,
    discoverCapabilities: async () => ({
      source,
      supported: true,
      objectLevels: ["campaign"] as const,
      metrics: ["impressions"] as const,
      extractionMethod: "file_import" as const,
    }),
    async *listObjects() {
      yield { page: 1, hasNextPage: false, rows: [{ objectLevel: "campaign", externalId: `${source}-campaign`, name: source }] };
    },
    async *getStats() {
      yield { page: 1, hasNextPage: false, rows: [{ objectLevel: "campaign", externalId: `${source}-campaign`, name: source, impressions: 10 }] };
    },
  };
}

describe("read-only export runner", () => {
  it("builds a bounded deterministic backfill period", () => {
    expect(buildBackfillPeriod(new Date("2026-08-13T12:00:00Z"), 7)).toEqual({ from: "2026-08-07", to: "2026-08-13" });
    expect(() => buildBackfillPeriod(new Date("2026-08-13T12:00:00Z"), 0)).toThrow("INVALID_BACKFILL_WINDOW");
    expect(() => buildBackfillPeriod(new Date("invalid"), 7)).toThrow("INVALID_BACKFILL_WINDOW");
  });

  it("persists one normalized snapshot and returns duplicate on retry", async () => {
    const snapshots = new InMemorySnapshotRepository();
    const runner = createReadOnlyExportRunner({
      adapters: new Map([["vk_ads", adapter()]]),
      snapshotRepository: snapshots,
    });
    const request = {
      source: "vk_ads" as const,
      accountId: "account-1",
      from: "2026-08-07",
      to: "2026-08-13",
      timezone: "Europe/Moscow",
      schemaVersion: "vk.v1",
    };
    const first = await runner.run(request);
    const second = await runner.run(request);
    expect(first.status).toBe("completed");
    expect(second.status).toBe("duplicate");
    expect(snapshots.list()).toHaveLength(1);
  });

  it("runs explicit scheduled configs without exposing provider mutation methods", async () => {
    const snapshots = new InMemorySnapshotRepository();
    const runner = createReadOnlyExportRunner({
      adapters: new Map([["vk_ads", adapter()]]),
      snapshotRepository: snapshots,
    });
    const results = await runner.runScheduled([{
      source: "vk_ads",
      accountId: "account-1",
      schemaVersion: "vk.v1",
      timezone: "Europe/Moscow",
      backfillDays: 3,
    }], new Date("2026-08-13T12:00:00Z"));
    expect(results[0]).toMatchObject({ status: "completed", rows: 1 });
    expect(Object.keys(runner).sort()).toEqual(["prepare", "run", "runScheduled"]);
  });

  it("fails closed for unsupported adapters and invalid periods", async () => {
    const runner = createReadOnlyExportRunner({ adapters: new Map(), snapshotRepository: new InMemorySnapshotRepository() });
    const unsupported = await runner.run({
      source: "telegram_ads",
      accountId: "account-telegram",
      from: "2026-08-07",
      to: "2026-08-13",
      timezone: "Europe/Moscow",
      schemaVersion: "telegram.v1",
    });
    expect(unsupported).toMatchObject({ status: "unsupported", code: "UNSUPPORTED_CAPABILITY" });
    const invalid = await runner.run({
      source: "telegram_ads",
      accountId: "account-telegram",
      from: "2026-08-14",
      to: "2026-08-13",
      timezone: "Europe/Moscow",
      schemaVersion: "telegram.v1",
    });
    expect(invalid).toMatchObject({ status: "failed", code: "INVALID_REQUEST" });
  });
});

