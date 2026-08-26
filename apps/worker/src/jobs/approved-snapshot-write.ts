import type { NormalizedProviderBatch } from "./provider-ingestion.js";
import { planProviderSnapshot, toD1WriteStatements, type D1WriteStatement } from "./provider-ingestion.js";
import type { ReconciliationResult } from "./reconciliation.js";

export type ApprovedSnapshotWriteRequest = {
  workspaceId: string;
  operatorSubject: string;
  batch: NormalizedProviderBatch;
  reconciliation: ReconciliationResult;
  existingHashes?: ReadonlySet<string>;
};

export type ApprovedSnapshotWritePlan = {
  workspaceId: string;
  operatorSubject: string;
  approvalId: string;
  action: "insert" | "skip_duplicate";
  contentHash: string;
  statements: readonly D1WriteStatement[];
};

export type D1StatementExecutor = (statements: readonly D1WriteStatement[]) => Promise<{ executed: number }>;

function safeScope(value: string, code: string): void {
  if (!value || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value) || /(?:password|secret|token|bearer|postgres(?:ql)?:\/\/)/i.test(value)) {
    throw new Error(code);
  }
}

export function createApprovedSnapshotWritePlan(request: ApprovedSnapshotWriteRequest): ApprovedSnapshotWritePlan {
  safeScope(request.workspaceId, "INVALID_WORKSPACE_SCOPE");
  safeScope(request.operatorSubject, "INVALID_OPERATOR_SUBJECT");
  const { batch, reconciliation } = request;
  if (reconciliation.source !== batch.source || reconciliation.accountId !== batch.accountId || reconciliation.period.from !== batch.from || reconciliation.period.to !== batch.to) {
    throw new Error("RECONCILIATION_SCOPE_MISMATCH");
  }
  if (reconciliation.status !== "matched") throw new Error("RECONCILIATION_APPROVAL_REQUIRED");
  const plan = planProviderSnapshot(batch, request.existingHashes ?? new Set());
  return {
    workspaceId: request.workspaceId,
    operatorSubject: request.operatorSubject,
    approvalId: `approval-${plan.contentHash.slice(0, 32)}`,
    action: plan.action,
    contentHash: plan.contentHash,
    statements: toD1WriteStatements(plan),
  };
}

export async function executeApprovedSnapshotWrite(
  plan: ApprovedSnapshotWritePlan,
  executor: D1StatementExecutor,
): Promise<{ status: "inserted" | "skipped_duplicate"; executed: number; approvalId: string; contentHash: string }> {
  if (plan.action === "skip_duplicate") return { status: "skipped_duplicate", executed: 0, approvalId: plan.approvalId, contentHash: plan.contentHash };
  if (typeof executor !== "function") throw new Error("D1_EXECUTOR_REQUIRED");
  const result = await executor(plan.statements);
  if (!Number.isInteger(result.executed) || result.executed !== plan.statements.length) throw new Error("D1_EXECUTOR_INCOMPLETE");
  return { status: "inserted", executed: result.executed, approvalId: plan.approvalId, contentHash: plan.contentHash };
}

