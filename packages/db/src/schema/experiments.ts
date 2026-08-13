export type TestStatus = "draft" | "planned" | "running" | "completed" | "approved" | "stopped";

export type ExperimentTest = {
  id: string;
  workspaceId: string;
  hypothesisId: string;
  status: TestStatus;
  startsOn: string;
  endsOn: string;
  primaryMetric: string;
  controlCreativeId: string;
  challengerCreativeIds: readonly string[];
};

export type DecisionOutcome = "scale" | "iterate" | "stop" | "inconclusive";

export type Decision = {
  id: string;
  testId: string;
  outcome: DecisionOutcome;
  decidedBy: string;
  rationale?: string;
  createdAt: string;
};

export const experimentConstraints = {
  decisionRequiresApprovedTest: true,
} as const;

