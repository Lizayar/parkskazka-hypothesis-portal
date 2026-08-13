import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import edgeWorker from "@portal/edge/index";
import { parsePublicMediaManifest } from "@portal/edge/media-manifest";

describe("Cloudflare free runtime contract", () => {
  it("declares only binding names and free-safe cron configuration", () => {
    const wrangler = readFileSync(resolve(process.cwd(), "wrangler.toml"), "utf8");
    expect(wrangler).toContain('main = "apps/edge/src/index.ts"');
    expect(wrangler).toContain("[[d1_databases]]");
    expect(wrangler).toContain("[[kv_namespaces]]");
    expect(wrangler).not.toMatch(/^\s*\[\[r2_buckets\]\]/m);
    expect(wrangler).toContain('crons = ["0 * * * *"]');
    expect(wrangler).toMatch(/database_id = "[0-9a-f-]{36}"/);
    expect(wrangler).toMatch(/id = "[0-9a-f]{32}"/i);
    expect(wrangler).toContain("R2 is intentionally enabled after the account-level R2 switch");
    expect(wrangler).not.toMatch(/(?:api[_-]?token|secret|password|Bearer)\s*[=:]\s*[^\s#]+/i);
  });

  it("serves read-only API routes from the Worker without storage credentials", async () => {
    const env = { READ_BACKEND: "fixture" as const };
    const health = await edgeWorker.fetch(new Request("https://edge.example/health"), env);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ service: "edge-api", status: "ready" });

    const summary = await edgeWorker.fetch(new Request("https://edge.example/api/summary"), env);
    expect(summary.status).toBe(200);
    expect(await summary.json()).toMatchObject({ kind: "summary", quality: "valid" });

    const mutation = await edgeWorker.fetch(
      new Request("https://edge.example/api/summary", { method: "POST" }),
      env,
    );
    expect(mutation.status).toBe(405);
  });

  it("reads D1 routes through the injected database and keeps lineage explicit", async () => {
    const calls: Array<{ query: string; values: unknown[] }> = [];
    const db = {
      prepare(query: string) {
        return {
          bind(...values: unknown[]) {
            calls.push({ query, values });
            return {
              async all<T>() {
                if (query.includes("GROUP BY mo.metric_key")) {
                  return { results: [{ metric_key: "leads", value: 2, quality_status: "valid" }] as T[] };
                }
                if (query.includes("FROM campaign c")) return { results: [] as T[] };
                return { results: [{ id: "h1", title: "D1 hook", status: "planned", owner_subject_id: "owner", starts_on: "2026-08-12", ends_on: "2026-08-19", primary_metric: "leads", decision: "inconclusive", source: "vk_ads" }] as T[] };
              },
            };
          },
        };
      },
    };
    const summary = await edgeWorker.fetch(new Request("https://edge.example/api/summary?source=vk_ads&from=2026-08-12"), { READ_BACKEND: "d1", DB: db });
    expect(summary.status).toBe(200);
    expect(await summary.json()).toMatchObject({ summary: { leads: 2, qualityBadge: "valid" } });
    const hypotheses = await edgeWorker.fetch(new Request("https://edge.example/api/hypotheses?source=vk_ads"), { READ_BACKEND: "d1", DB: db });
    expect(hypotheses.status).toBe(200);
    expect(await hypotheses.json()).toMatchObject({ items: [{ id: "h1", source: "vk_ads" }] });
    const explorer = await edgeWorker.fetch(new Request("https://edge.example/api/explorer"), { READ_BACKEND: "d1", DB: db });
    expect(await explorer.json()).toMatchObject({ quality: "lineage_not_available", tree: [] });
    const media = await edgeWorker.fetch(new Request("https://edge.example/api/media"), { READ_BACKEND: "d1", DB: db });
    expect(await media.json()).toMatchObject({ kind: "media", storagePolicy: "pages-and-github-releases" });
    expect(calls.every((call) => !call.query.includes("${"))).toBe(true);
  });

  it("fails closed when D1 backend has no binding", async () => {
    const response = await edgeWorker.fetch(
      new Request("https://edge.example/api/summary"),
      { READ_BACKEND: "d1" as const },
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "D1_BINDING_REQUIRED" });
    const invalid = await edgeWorker.fetch(new Request("https://edge.example/api/summary?from=bad"), { READ_BACKEND: "fixture" });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "INVALID_READ_FILTER" });
  });

  it("maps complete D1 lineage and marks incomplete rows without inventing children", async () => {
    const db = {
      prepare(query: string) {
        return { bind() { return { async all<T>() {
          if (query.includes("FROM campaign c")) {
            return { results: [{ campaign_id: "c1", campaign_name: "Summer", source: "vk_ads", ad_group_id: "g1", ad_group_name: "Families", ad_id: "a1", ad_name: "Control", creative_id: "cr1", creative_name: "Hook A" }] as T[] };
          }
          return { results: [] as T[] };
        } }; }, };
      },
    };
    const response = await edgeWorker.fetch(new Request("https://edge.example/api/explorer?source=vk_ads&from=2026-08-12"), { READ_BACKEND: "d1", DB: db });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ quality: "valid", tree: [{ campaignId: "c1", adGroups: [{ ads: [{ creatives: [{ creativeId: "cr1" }] }] }] }] });
  });

  it("contains a Pages static shell", () => {
    const html = readFileSync(resolve(process.cwd(), "cloudflare/pages/index.html"), "utf8");
    expect(html).toContain("Park Skazka Hypothesis Portal");
    expect(html).toContain("https://parkskazka-hypothesis-edge.parkskazka-hypothesis-portal.workers.dev/api/summary");
    expect(html).toContain("/media/manifest.json");
    const manifest = readFileSync(resolve(process.cwd(), "cloudflare/pages/media/manifest.json"), "utf8");
    expect(JSON.parse(manifest)).toMatchObject({ storagePolicy: "pages-and-github-releases", public: true });
    expect(() => parsePublicMediaManifest({ version: 1, storagePolicy: "pages-and-github-releases", public: true, items: [{ id: "x", url: "https://github.com/Lizayar/parkskazka-hypothesis-portal/releases/download/v1/x.png", kind: "image" }] })).not.toThrow();
    expect(() => parsePublicMediaManifest({ version: 1, storagePolicy: "pages-and-github-releases", public: true, items: [{ id: "x", url: "http://github.com/x", kind: "image" }] })).toThrow("INVALID_MEDIA_MANIFEST");
  });

  it("documents the permanent free contour and its explicit D1 boundary", () => {
    const docs = readFileSync(resolve(process.cwd(), "docs/architecture/production-stack.md"), "utf8");
    expect(docs).toContain("Постоянный бесплатный контур Cloudflare");
    expect(docs).toContain("SQLite-семантику");
    expect(docs).toContain("не выполняет silent fallback");
    const media = readFileSync(resolve(process.cwd(), "docs/architecture/free-media-strategy.md"), "utf8");
    expect(media).toContain("без платёжной подписки");
    expect(media).toContain("GitHub Releases");
    const seed = readFileSync(resolve(process.cwd(), "cloudflare/d1/seed.sql"), "utf8");
    expect(seed).toContain("INSERT OR IGNORE INTO hypothesis");
    expect(seed).toContain("INSERT OR IGNORE INTO source_snapshot");
    expect(seed).not.toMatch(/(?:api[_-]?token|secret|password|Bearer|postgres:\/\/)/i);
  });
});

