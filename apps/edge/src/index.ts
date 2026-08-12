export type ReadBackend = "fixture" | "d1";

export type D1DatabaseLike = {
  prepare(query: string): {
    bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> };
  };
};

export type KVNamespaceLike = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

export type R2BucketLike = {
  get(key: string): Promise<unknown | null>;
  put(key: string, value: ArrayBuffer | ReadableStream | string): Promise<unknown>;
};

export type EdgeEnv = {
  READ_BACKEND?: ReadBackend;
  DB?: D1DatabaseLike;
  CACHE?: KVNamespaceLike;
  MEDIA?: R2BucketLike;
};

export type ScheduledControllerLike = { scheduledTime?: number };

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function handleEdgeRequest(request: Request, env: EdgeEnv = {}): Promise<Response> {
  if (request.method !== "GET") return json({ error: "READ_ONLY_ROUTE" }, 405);

  const url = new URL(request.url);
  const kind = url.pathname.split("/").filter(Boolean).at(-1);
  if (url.pathname === "/" || url.pathname === "/health") {
    return json({
      service: "edge-api",
      status: "ready",
      backend: env.READ_BACKEND ?? "fixture",
      bindings: {
        d1: Boolean(env.DB),
        kv: Boolean(env.CACHE),
        r2: Boolean(env.MEDIA),
      },
    });
  }
  if (kind !== "summary" && kind !== "hypotheses" && kind !== "explorer") {
    return json({ error: "NOT_FOUND" }, 404);
  }
  if ((env.READ_BACKEND ?? "fixture") === "d1") {
    return json({ error: "D1_READ_ROUTE_NOT_MAPPED" }, 501);
  }

  const source = url.searchParams.get("source");
  const filters = {
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    ...(source ? { source } : {}),
  };
  if (source && source !== fixture.source) {
    if (kind === "summary") return json({ kind, filters, summary: null, quality: "not_loaded" });
    if (kind === "hypotheses") return json({ kind, filters, items: [] });
    return json({ kind, filters, tree: [] });
  }
  if (kind === "summary") return json({ kind, filters, summary: fixture.summary, quality: fixture.summary.qualityBadge });
  if (kind === "hypotheses") return json({ kind, filters, items: fixture.hypotheses });
  return json({ kind, filters, tree: fixture.tree });
}

const worker = {
  fetch(request: Request, env: EdgeEnv): Promise<Response> {
    return handleEdgeRequest(request, env);
  },
  async scheduled(_controller: ScheduledControllerLike, _env: EdgeEnv): Promise<void> {
    // Free runtime keeps scheduled ingestion explicit until D1 adapters are wired.
  },
};

export default worker;

