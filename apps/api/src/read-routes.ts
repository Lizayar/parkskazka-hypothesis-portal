import { parsePortalFilters } from "@portal/ui/read-models";
import {
  buildDashboardSummary,
  buildExplorerTree,
  buildHypothesisJournal,
} from "@portal/ui/read-models";
import type { HypothesisJournalItem } from "@portal/ui/read-models";
import { createParkSkazkaFixture } from "@portal/db/fixtures/park-skazka-fixture";

function fixturePayload() {
  const fixture = createParkSkazkaFixture();
  const summary = buildDashboardSummary({
    dateRange: {
      from: fixture.test.startsOn,
      to: fixture.test.endsOn,
      timezone: fixture.workspace.timezone,
    },
    source: fixture.sourceAccount.source,
    spend: 12500,
    impressions: 42000,
    clicks: 980,
    leads: 48,
    quality: "valid",
    maturity: "mature",
  });
  const hypotheses = buildHypothesisJournal([
    {
      id: fixture.hypothesis.id,
      title: fixture.hypothesis.title,
      status: fixture.hypothesis.status,
      ownerSubjectId: fixture.hypothesis.ownerSubjectId,
      source: fixture.sourceAccount.source,
      startsOn: fixture.hypothesis.startsOn,
      endsOn: fixture.hypothesis.endsOn,
      primaryMetric: fixture.hypothesis.primaryMetric,
      decision: "inconclusive",
    },
  ]);
  const tree = buildExplorerTree([
    {
      campaignId: fixture.campaign.id,
      campaignName: fixture.campaign.name,
      adGroupId: fixture.adGroup.id,
      adGroupName: fixture.adGroup.name,
      adId: fixture.ad.id,
      adName: fixture.ad.name,
      creativeId: fixture.creative.id,
      creativeName: fixture.creative.name,
      source: fixture.campaign.source,
    },
  ]);
  return { fixture, summary, hypotheses, tree };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleReadRequest(request: Request): Promise<Response> {
  if (request.method !== "GET") return json({ error: "READ_ONLY_ROUTE" }, 405);

  const url = new URL(request.url);
  const kind = url.pathname.split("/").filter(Boolean).at(-1);
  if (kind !== "summary" && kind !== "hypotheses" && kind !== "explorer") {
    return json({ error: "NOT_FOUND" }, 404);
  }

  try {
    const filters = parsePortalFilters({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      timezone: url.searchParams.get("timezone") ?? undefined,
      source: url.searchParams.get("source") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      ownerSubjectId: url.searchParams.get("ownerSubjectId") ?? undefined,
    });

    const payload = fixturePayload();
    if (kind === "summary") {
      const summary = filters.source && filters.source !== payload.summary.source ? null : payload.summary;
      return json({ kind, filters, summary, quality: summary?.qualityBadge ?? "not_loaded" });
    }
    if (kind === "hypotheses") {
      const items = buildHypothesisJournal(payload.hypotheses, {
        status: filters.status as HypothesisJournalItem["status"] | undefined,
        ownerSubjectId: filters.ownerSubjectId,
        source: filters.source,
      });
      return json({ kind, filters, items });
    }
    const tree = filters.source && filters.source !== payload.fixture.campaign.source ? [] : payload.tree;
    return json({ kind, filters, tree });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_FILTERS";
    const safeCode = code.startsWith("INVALID_") ? code : "INVALID_FILTERS";
    return json({ error: safeCode }, 400);
  }
}

