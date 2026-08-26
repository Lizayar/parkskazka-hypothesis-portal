import { createServer } from "node:http";

const port = Number(process.env.API_PORT || 3001);
const host = process.env.API_HOST || "127.0.0.1";
const backend = process.env.PORTAL_READ_BACKEND || "fixture";

const fixture = {
  source: "vk_ads",
  summary: {
    source: "vk_ads",
    spend: 12500,
    impressions: 42000,
    clicks: 980,
    leads: 48,
    qualityBadge: "valid",
    maturityBadge: "mature",
  },
  hypotheses: [
    {
      id: "hypothesis-family-hook-fixture",
      title: "Hook про семейный выходной повысит intent",
      status: "planned",
      ownerSubjectId: "github|fixture-owner",
      source: "vk_ads",
      startsOn: "2026-08-12",
      endsOn: "2026-08-19",
      primaryMetric: "cost_per_lead",
      decision: "inconclusive",
    },
  ],
  tree: [
    {
      campaignId: "campaign-summer-fixture",
      campaignName: "Summer Park Visit",
      source: "vk_ads",
      adGroups: [
        {
          adGroupId: "ad-group-fixture",
          adGroupName: "Families 25-44",
          ads: [
            {
              adId: "ad-control-fixture",
              adName: "Control rotation A",
              creatives: [{ creativeId: "creative-control-fixture", creativeName: "Control: family weekend" }],
            },
          ],
        },
      ],
    },
  ],
};

function json(response, body, status = 200) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function handleRequest(request, response) {
  if (request.method !== "GET") return json(response, { error: "READ_ONLY_ROUTE" }, 405);
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/health" || url.pathname === "/") {
    return json(response, { service: "api", status: "ready", backend });
  }
  const kind = url.pathname.split("/").filter(Boolean).at(-1);
  if (!["summary", "hypotheses", "explorer"].includes(kind)) {
    return json(response, { error: "NOT_FOUND" }, 404);
  }
  if (backend === "postgres") return json(response, { error: "POSTGRES_READ_ROUTE_NOT_MAPPED" }, 501);

  const source = url.searchParams.get("source");
  if (source && source !== fixture.source) {
    if (kind === "summary") return json(response, { kind, filters: { source }, summary: null, quality: "not_loaded" });
    if (kind === "hypotheses") return json(response, { kind, filters: { source }, items: [] });
    return json(response, { kind, filters: { source }, tree: [] });
  }
  const filters = {
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    ...(source ? { source } : {}),
  };
  if (kind === "summary") return json(response, { kind, filters, summary: fixture.summary, quality: fixture.summary.qualityBadge });
  if (kind === "hypotheses") return json(response, { kind, filters, items: fixture.hypotheses });
  return json(response, { kind, filters, tree: fixture.tree });
}

createServer(handleRequest).listen(port, host, () => {
  console.log(`api read server listening on http://${host}:${port}`);
});

