import { describe, expect, it } from "vitest";
import type { PortalReadRow } from "@portal/db/repositories/postgres-read-repository";
import {
  mapPostgresRowsToReadModels,
  type MetricObservationInput,
} from "@portal/ui/postgres-read-mapper";

const baseRow: PortalReadRow = {
  workspaceId: "workspace-1",
  workspaceSlug: "parkskazka",
  workspaceName: "Park Skazka",
  timezone: "Europe/Moscow",
  campaignId: "campaign-1",
  campaignName: "Summer",
  source: "vk_ads",
  adGroupId: "group-1",
  adGroupName: "Families",
  adId: "ad-1",
  adName: "Control A",
  creativeId: "creative-1",
  creativeName: "Family weekend",
  hypothesisId: "hypothesis-1",
  hypothesisTitle: "Family hook",
  hypothesisStatus: "running",
  hypothesisOwnerSubjectId: "github|owner",
  primaryMetric: "cost_per_lead",
  startsOn: "2026-08-12",
  endsOn: "2026-08-19",
  decisionOutcome: "iterate",
};

describe("postgres read-model mapper", () => {
  it("groups repeated hierarchy rows and maps a complete hypothesis", () => {
    const result = mapPostgresRowsToReadModels([
      baseRow,
      { ...baseRow, creativeId: "creative-2", creativeName: "Family weekend challenger" },
    ]);

    expect(result.hypotheses).toEqual([
      expect.objectContaining({
        id: "hypothesis-1",
        ownerSubjectId: "github|owner",
        primaryMetric: "cost_per_lead",
        decision: "iterate",
      }),
    ]);
    expect(result.tree).toHaveLength(1);
    expect(result.tree[0]?.adGroups[0]?.ads[0]?.creatives).toHaveLength(2);
  });

  it("does not fabricate metric values when observations are absent or invalid", () => {
    const invalidObservation: MetricObservationInput = {
      metricKey: "cost_per_lead",
      value: null,
      qualityStatus: "invalid",
    };

    expect(mapPostgresRowsToReadModels([baseRow]).metrics).toEqual({
      status: "not_loaded",
      observations: [],
    });
    expect(mapPostgresRowsToReadModels([baseRow], [invalidObservation]).metrics).toEqual({
      status: "insufficient",
      observations: [invalidObservation],
    });
  });

  it("omits incomplete hierarchy rows from explorer without dropping hypotheses", () => {
    const result = mapPostgresRowsToReadModels([
      baseRow,
      { ...baseRow, adGroupId: undefined, adId: undefined, creativeId: undefined },
    ]);

    expect(result.hypotheses).toHaveLength(1);
    expect(result.tree[0]?.adGroups[0]?.ads[0]?.creatives).toHaveLength(1);
  });
});

