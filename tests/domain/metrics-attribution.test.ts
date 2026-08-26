import { describe, expect, it } from "vitest";
import {
  compareDateRanges,
  metricDefinition,
  evaluateMeasurementGate,
  joinUtmToMetrica,
} from "@portal/domain/metrics/attribution";

describe("canonical metrics and attribution", () => {
  it("distinguishes platform metrics, site conversions and derived ratios", () => {
    expect(metricDefinition("vk_ads.spend")).toMatchObject({
      kind: "platform",
      numerator: "spend",
      denominator: null,
    });
    expect(metricDefinition("yandex_metrica.goal.lead")).toMatchObject({
      kind: "site_conversion",
      numerator: "goal_completions",
      denominator: null,
    });
    expect(metricDefinition("derived.cpl")).toMatchObject({
      kind: "derived",
      numerator: "spend",
      denominator: "goal.lead",
    });
  });

  it("preserves timezone and attribution model in date-range comparisons", () => {
    expect(
      compareDateRanges(
        { from: "2026-08-01", to: "2026-08-07", timezone: "Europe/Moscow" },
        { from: "2026-07-25", to: "2026-07-31", timezone: "Europe/Moscow" },
        "lastsign",
      ),
    ).toMatchObject({
      current: { from: "2026-08-01", to: "2026-08-07" },
      previous: { from: "2026-07-25", to: "2026-07-31" },
      timezone: "Europe/Moscow",
      attributionModel: "lastsign",
      comparable: true,
    });
  });

  it("does not silently join ambiguous or unmatched UTM values", () => {
    expect(
      joinUtmToMetrica(
        { source: "vk", medium: "cpc", campaign: "summer" },
        [
          { source: "vk", medium: "cpc", campaign: "summer", sessions: 100, goals: 5 },
          { source: "vk", medium: "cpc", campaign: "summer", sessions: 120, goals: 6 },
        ],
      ),
    ).toMatchObject({ verdict: "ambiguous", sessions: null, goals: null });

    expect(
      joinUtmToMetrica(
        { source: "avito", medium: "native", campaign: "unknown" },
        [{ source: "vk", medium: "cpc", campaign: "summer", sessions: 100, goals: 5 }],
      ),
    ).toMatchObject({ verdict: "unmatched", sessions: null, goals: null });
  });

  it("blocks scale when quality or maturity gates fail", () => {
    expect(
      evaluateMeasurementGate({ quality: "valid", maturity: "insufficient", controlValid: true, guardrailsClear: true }),
    ).toMatchObject({ decision: "blocked", reasons: ["INSUFFICIENT_MATURITY"] });
    expect(
      evaluateMeasurementGate({ quality: "valid", maturity: "mature", controlValid: true, guardrailsClear: true }),
    ).toMatchObject({ decision: "eligible" });
  });
});

