import { describe, expect, it } from "vitest";
import {
  buildDashboardSummary,
  buildHypothesisJournal,
  buildExplorerTree,
  parsePortalFilters,
} from "@portal/ui/read-models";

const fixture = {
  dateRange: { from: "2026-08-12", to: "2026-08-12", timezone: "Europe/Moscow" },
  source: "vk_ads" as const,
  spend: 12500,
  impressions: 42000,
  clicks: 980,
  leads: 48,
  quality: "valid" as const,
  maturity: "mature" as const,
};

describe("portal read models", () => {
  it("builds a semantic dashboard summary with derived ratios and quality badge", () => {
    expect(buildDashboardSummary(fixture)).toMatchObject({
      source: "vk_ads",
      spend: 12500,
      ctr: expect.closeTo(980 / 42000, 5),
      cpl: expect.closeTo(12500 / 48, 5),
      qualityBadge: "valid",
      maturityBadge: "mature",
    });
  });

  it("filters hypotheses by lifecycle, owner and source while preserving test window", () => {
    const journal = buildHypothesisJournal([
      {
        id: "h-1",
        title: "Family hook",
        status: "running",
        ownerSubjectId: "github|42",
        source: "vk_ads",
        startsOn: "2026-08-12",
        endsOn: "2026-08-19",
        primaryMetric: "derived.cpl",
        decision: "inconclusive",
      },
      {
        id: "h-2",
        title: "Old test",
        status: "completed",
        ownerSubjectId: "github|99",
        source: "avito_ads",
        startsOn: "2026-07-01",
        endsOn: "2026-07-07",
        primaryMetric: "derived.cpl",
        decision: "stop",
      },
    ], { status: "running", ownerSubjectId: "github|42", source: "vk_ads" });

    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({ id: "h-1", startsOn: "2026-08-12", endsOn: "2026-08-19" });
  });

  it("preserves campaign hierarchy for explorer drill-down", () => {
    const tree = buildExplorerTree([
      { campaignId: "c-1", campaignName: "Summer", adGroupId: "g-1", adGroupName: "Families", adId: "a-1", adName: "Control", creativeId: "cr-1", creativeName: "Hook A", source: "vk_ads" },
    ]);

    expect(tree).toEqual([
      expect.objectContaining({
        campaignId: "c-1",
        adGroups: [expect.objectContaining({ ads: [expect.objectContaining({ creatives: [{ creativeId: "cr-1", creativeName: "Hook A" }] })] })],
      }),
    ]);
  });

  it("parses safe filters and rejects invalid date ranges", () => {
    expect(parsePortalFilters({ from: "2026-08-01", to: "2026-08-07", source: "vk_ads" })).toEqual({
      from: "2026-08-01", to: "2026-08-07", timezone: "Europe/Moscow", source: "vk_ads",
    });
    expect(() => parsePortalFilters({ from: "2026-08-08", to: "2026-08-01" })).toThrow("INVALID_DATE_RANGE");
  });
});

