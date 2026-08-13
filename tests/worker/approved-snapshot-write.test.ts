import { describe, expect, it } from "vitest";
import { createVkAdsAdapter } from "@portal/adapters/vk-ads/adapter";
import { vkFixtureExport } from "@portal/adapters/vk-ads/fixtures";
import { collectProviderBatch } from "@portal/worker/jobs/provider-ingestion";
import { reconcileNormalizedBatch } from "@portal/worker/jobs/reconciliation";
import { createApprovedSnapshotWritePlan, executeApprovedSnapshotWrite } from "@portal/worker/jobs/approved-snapshot-write";

async function matched() {
  const batch = await collectProviderBatch({
    adapter: createVkAdsAdapter({ accountId: "vk-account", currency: "RUB", exportRows: vkFixtureExport }),
    accountId: "vk-account",
    from: "2026-08-12",
    to: "2026-08-12",
    timezone: "Europe/Moscow",
    schemaVersion: "vk.v1",
  });
  return { batch, reconciliation: reconcileNormalizedBatch(batch, { spend: 12500, impressions: 42000, clicks: 980 }) };
}

describe("approved D1 snapshot write", () => {
  it("creates parameterized write plan only after matched reconciliation", async () => {
    const { batch, reconciliation } = await matched();
    const plan = createApprovedSnapshotWritePlan({ workspaceId: "workspace-parkskazka", operatorSubject: "github|lizayar", batch, reconciliation });
    expect(plan).toMatchObject({ action: "insert", workspaceId: "workspace-parkskazka", operatorSubject: "github|lizayar" });
    expect(plan.statements.length).toBeGreaterThan(1);
    expect(plan.statements.every((statement) => statement.sql.includes("?"))).toBe(true);
    expect(plan.statements.map((statement) => statement.sql).join(" ")).not.toContain(batch.rows[0]?.name);
  });

  it("rejects partial/mismatch/scope errors and unsafe operator scope", async () => {
    const { batch, reconciliation } = await matched();
    expect(() => createApprovedSnapshotWritePlan({ workspaceId: "w", operatorSubject: "o", batch, reconciliation: { ...reconciliation, status: "partial" } })).toThrow("RECONCILIATION_APPROVAL_REQUIRED");
    expect(() => createApprovedSnapshotWritePlan({ workspaceId: "w", operatorSubject: "o", batch, reconciliation: { ...reconciliation, accountId: "other" } })).toThrow("RECONCILIATION_SCOPE_MISMATCH");
    expect(() => createApprovedSnapshotWritePlan({ workspaceId: "w", operatorSubject: "Bearer secret", batch, reconciliation })).toThrow("INVALID_OPERATOR_SUBJECT");
  });

  it("executes approved statements through an injected executor and skips duplicates", async () => {
    const { batch, reconciliation } = await matched();
    const first = createApprovedSnapshotWritePlan({ workspaceId: "w", operatorSubject: "o", batch, reconciliation });
    const calls: readonly unknown[][] = [];
    const result = await executeApprovedSnapshotWrite(first, async (statements) => {
      (calls as unknown[][]).push(statements as unknown[]);
      return { executed: statements.length };
    });
    expect(result).toMatchObject({ status: "inserted", executed: first.statements.length });
    expect(calls).toHaveLength(1);
    const duplicate = createApprovedSnapshotWritePlan({ workspaceId: "w", operatorSubject: "o", batch, reconciliation, existingHashes: new Set([first.contentHash]) });
    const skipped = await executeApprovedSnapshotWrite(duplicate, async () => { throw new Error("must_not_execute"); });
    expect(skipped).toMatchObject({ status: "skipped_duplicate", executed: 0 });
  });

  it("fails closed for incomplete executor result", async () => {
    const { batch, reconciliation } = await matched();
    const plan = createApprovedSnapshotWritePlan({ workspaceId: "w", operatorSubject: "o", batch, reconciliation });
    await expect(executeApprovedSnapshotWrite(plan, async () => ({ executed: 0 }))).rejects.toThrow("D1_EXECUTOR_INCOMPLETE");
  });
});

