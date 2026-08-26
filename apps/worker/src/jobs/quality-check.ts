import type { Snapshot } from "@portal/db/schema/ingestion";

export type QualityVerdict = {
  status: Snapshot["qualityStatus"];
  warnings: readonly string[];
};

export function evaluateSnapshotQuality(input: {
  rowCount: number;
  expectedRows?: number;
  hasPeriod: boolean;
  hasSchema: boolean;
  sourceError?: boolean;
}): QualityVerdict {
  if (!input.hasPeriod || !input.hasSchema) {
    return { status: "invalid", warnings: ["snapshot_contract_invalid"] };
  }
  if (input.sourceError) {
    return { status: "needs_attention", warnings: ["source_returned_partial_data"] };
  }
  if (input.expectedRows !== undefined && input.rowCount < input.expectedRows) {
    return { status: "partial", warnings: ["row_count_below_expectation"] };
  }
  return { status: "valid", warnings: [] };
}

