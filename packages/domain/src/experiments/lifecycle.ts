export type HypothesisStatus = "draft" | "planned" | "running" | "completed" | "stopped";

export type HypothesisInput = {
  id: string;
  workspaceId: string;
  title: string;
  statement: string;
  ownerSubjectId: string;
  startsOn: string;
  endsOn: string;
  primaryMetric: string;
  guardrailMetrics: readonly string[];
};

export type Hypothesis = HypothesisInput & {
  status: HypothesisStatus;
};

const transitions: Record<HypothesisStatus, readonly HypothesisStatus[]> = {
  draft: ["planned", "stopped"],
  planned: ["running", "stopped"],
  running: ["completed", "stopped"],
  completed: [],
  stopped: [],
};

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function createHypothesis(input: HypothesisInput): Hypothesis {
  if (!input.id || !input.workspaceId || !input.ownerSubjectId || !input.title || !input.statement) {
    throw new Error("HYPOTHESIS_REQUIRED_FIELDS");
  }
  if (!validDate(input.startsOn) || !validDate(input.endsOn) || input.startsOn > input.endsOn) {
    throw new Error("INVALID_TEST_WINDOW");
  }
  if (!input.primaryMetric || input.guardrailMetrics.length === 0) {
    throw new Error("METRICS_REQUIRED");
  }
  return { ...input, guardrailMetrics: [...input.guardrailMetrics], status: "draft" };
}

export function transitionHypothesis(hypothesis: Hypothesis, next: HypothesisStatus): Hypothesis {
  if (!transitions[hypothesis.status].includes(next)) {
    throw new Error("INVALID_TRANSITION");
  }
  return { ...hypothesis, status: next };
}

export type Rotation = {
  creativeId: string;
  startsOn: string;
  endsOn?: string;
};

export type Experiment = {
  id: string;
  hypothesisId: string;
  workspaceId: string;
  status: "running" | "completed" | "stopped";
  startsOn: string;
  endsOn: string;
  controlCreativeId: string;
  challengerCreativeIds: readonly string[];
  rotations: readonly Rotation[];
};

export function startExperiment(input: {
  hypothesis: Hypothesis;
  controlCreativeId: string;
  challengerCreativeIds: readonly string[];
}): Experiment {
  if (input.hypothesis.status !== "planned") throw new Error("HYPOTHESIS_NOT_PLANNED");
  if (!input.controlCreativeId) throw new Error("CONTROL_REQUIRED");
  if (input.challengerCreativeIds.length === 0) throw new Error("CHALLENGER_REQUIRED");
  if (!validDate(input.hypothesis.startsOn) || !validDate(input.hypothesis.endsOn) || input.hypothesis.startsOn > input.hypothesis.endsOn) {
    throw new Error("INVALID_TEST_WINDOW");
  }
  return {
    id: `test-${input.hypothesis.id}`,
    hypothesisId: input.hypothesis.id,
    workspaceId: input.hypothesis.workspaceId,
    status: "running",
    startsOn: input.hypothesis.startsOn,
    endsOn: input.hypothesis.endsOn,
    controlCreativeId: input.controlCreativeId,
    challengerCreativeIds: [...input.challengerCreativeIds],
    rotations: input.challengerCreativeIds.map((creativeId) => ({
      creativeId,
      startsOn: input.hypothesis.startsOn,
    })),
  };
}

export function rotateChallenger(experiment: Experiment, creativeId: string, startsOn: string): Experiment {
  if (!creativeId) throw new Error("CREATIVE_REQUIRED");
  if (!validDate(startsOn) || startsOn < experiment.startsOn || startsOn > experiment.endsOn) {
    throw new Error("ROTATION_OUTSIDE_TEST_WINDOW");
  }
  const rotations = experiment.rotations.map((rotation, index) => {
    if (index === experiment.rotations.length - 1 && !rotation.endsOn) {
      return { ...rotation, endsOn: startsOn };
    }
    return rotation;
  });
  return {
    ...experiment,
    challengerCreativeIds: [...experiment.challengerCreativeIds, creativeId],
    rotations: [...rotations, { creativeId, startsOn }],
  };
}

export type DecisionInput = {
  quality: "valid" | "partial" | "invalid";
  maturity: "insufficient" | "mature";
  controlValid: boolean;
  guardrailsClear: boolean;
  primaryMetric: {
    direction: "increase" | "decrease";
    relativeEffect: number;
    minimumEffect: number;
  };
};

export type DecisionResult = {
  outcome: "scale" | "iterate" | "stop" | "inconclusive";
  reasons: readonly string[];
};

export function evaluateDecision(input: DecisionInput): DecisionResult {
  if (input.quality !== "valid") return { outcome: "stop", reasons: ["QUALITY_NOT_VALID"] };
  if (input.maturity !== "mature") return { outcome: "inconclusive", reasons: ["INSUFFICIENT_MATURITY"] };
  if (!input.controlValid) return { outcome: "inconclusive", reasons: ["CONTROL_INVALID"] };
  if (!input.guardrailsClear) return { outcome: "stop", reasons: ["GUARDRAIL_BREACH"] };

  const effect = input.primaryMetric.relativeEffect;
  const desired = input.primaryMetric.direction === "decrease" ? effect <= -input.primaryMetric.minimumEffect : effect >= input.primaryMetric.minimumEffect;
  if (desired) return { outcome: "scale", reasons: [] };
  if (Math.abs(effect) < input.primaryMetric.minimumEffect) return { outcome: "inconclusive", reasons: ["EFFECT_BELOW_MINIMUM"] };
  return { outcome: "iterate", reasons: ["EFFECT_DIRECTION_MISALIGNED"] };
}

