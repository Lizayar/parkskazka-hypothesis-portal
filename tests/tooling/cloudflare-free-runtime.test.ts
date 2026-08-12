import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import edgeWorker from "@portal/edge/index";

describe("Cloudflare free runtime contract", () => {
  it("declares only binding names and free-safe cron configuration", () => {
    const wrangler = readFileSync(resolve(process.cwd(), "wrangler.toml"), "utf8");
    expect(wrangler).toContain('main = "apps/edge/src/index.ts"');
    expect(wrangler).toContain("[[d1_databases]]");
    expect(wrangler).toContain("[[kv_namespaces]]");
    expect(wrangler).toContain("[[r2_buckets]]");
    expect(wrangler).toContain('crons = ["0 * * * *"]');
    expect(wrangler).toContain("REPLACE_AFTER_CLOUDFLARE_CREATE");
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

  it("keeps D1 rollout explicit instead of silently falling back", async () => {
    const response = await edgeWorker.fetch(
      new Request("https://edge.example/api/summary"),
      { READ_BACKEND: "d1" as const },
    );
    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({ error: "D1_READ_ROUTE_NOT_MAPPED" });
  });

  it("contains a Pages static shell", () => {
    const html = readFileSync(resolve(process.cwd(), "cloudflare/pages/index.html"), "utf8");
    expect(html).toContain("Park Skazka Hypothesis Portal");
    expect(html).toContain("/api/summary");
  });

  it("documents the permanent free contour and its explicit D1 boundary", () => {
    const docs = readFileSync(resolve(process.cwd(), "docs/architecture/production-stack.md"), "utf8");
    expect(docs).toContain("Постоянный бесплатный контур Cloudflare");
    expect(docs).toContain("SQLite-семантику");
    expect(docs).toContain("не выполняет silent fallback");
  });
});

