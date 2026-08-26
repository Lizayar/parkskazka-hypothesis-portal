import { describe, expect, it } from "vitest";
import {
  createHypothesis,
  transitionHypothesis,
  startExperiment,
  rotateChallenger,
  evaluateDecision,
} from "@portal/domain/experiments/lifecycle";

const base = {
  id: "hypothesis-1",
  workspaceId: "workspace-1",
  title: "Family hook",
  statement: "A family hook will reduce CPL",
  ownerSubjectId: "github|42",
  startsOn: "2026-08-12",
  endsOn: "2026-08-19",
  primaryMetric: "derived.cpl",
  guardrailMetrics: ["bounce_rate"],
};

describe("hypothesis lifecycle and decision engine", () => {
  it("allows only valid lifecycle transitions", () => {
    const hypothesis = createHypothesis(base);
    expect(transitionHypothesis(hypothesis, "planned").status).toBe("planned");
    expect(transitionHypothesis({ ...hypothesis, status: "planned" }, "running").status).toBe("running");
    expect(() => transitionHypothesis(hypothesis, "completed")).toThrow("INVALID_TRANSITION");
  });

  it("requires bounded dates, control and challenger before starting", () => {
    const hypothesis = { ...createHypothesis(base), status: "planned" as const };
    expect(() =>
      startExperiment({
        hypothesis,
        controlCreativeId: "creative-control",
        challengerCreativeIds: [],
      }),
    ).toThrow("CHALLENGER_REQUIRED");

    const test = startExperiment({
      hypothesis,
      controlCreativeId: "creative-control",
      challengerCreativeIds: ["creative-challenger"],
    });
    expect(test.status).toBe("running");
    expect(test.startsOn).toBe("2026-08-12");
    expect(test.endsOn).toBe("2026-08-19");
  });

  it("rotates challengers while preserving exposure windows and lineage", () => {
    const hypothesis = { ...createHypothesis(base), status: "planned" as const };
    const test = startExperiment({
      hypothesis,
      controlCreativeId: "creative-control",
      challengerCreativeIds: ["creative-a"],
    });
    const rotated = rotateChallenger(test, "creative-b", "2026-08-15");

    expect(rotated.challengerCreativeIds).toEqual(["creative-a", "creative-b"]);
    expect(rotated.rotations).toEqual(expect.arrayContaining([
      expect.objectContaining({ creativeId: "creative-b", startsOn: "2026-08-15" }),
    ]));
  });

  it("returns deterministic scale, iterate, stop or inconclusive outcomes", () => {
    const eligible = {
      quality: "valid" as const,
      maturity: "mature" as const,
      controlValid: true,
      guardrailsClear: true,
      primaryMetric: { direction: "decrease" as const, relativeEffect: -0.25, minimumEffect: 0.1 },
    };
    expect(evaluateDecision(eligible)).toMatchObject({ outcome: "scale", reasons: [] });
    expect(evaluateDecision({ ...eligible, primaryMetric: { ...eligible.primaryMetric, relativeEffect: -0.02 } })).toMatchObject({ outcome: "inconclusive" });
    expect(evaluateDecision({ ...eligible, guardrailsClear: false })).toMatchObject({ outcome: "stop" });
    expect(evaluateDecision({ ...eligible, primaryMetric: { ...eligible.primaryMetric, relativeEffect: 0.15 } })).toMatchObject({ outcome: "iterate" });
  });
});

