import { describe, expect, it } from "vitest";
import { evaluateSnapshotQuality } from "@portal/worker/jobs/quality-check";

describe("snapshot quality verdicts", () => {
  it("marks invalid schema or period without leaking source details", () => {
    expect(
      evaluateSnapshotQuality({ rowCount: 1, hasPeriod: false, hasSchema: true }),
    ).toEqual({ status: "invalid", warnings: ["snapshot_contract_invalid"] });
  });

  it("marks source failures as needs_attention", () => {
    expect(
      evaluateSnapshotQuality({ rowCount: 10, hasPeriod: true, hasSchema: true, sourceError: true }),
    ).toEqual({ status: "needs_attention", warnings: ["source_returned_partial_data"] });
  });
});

