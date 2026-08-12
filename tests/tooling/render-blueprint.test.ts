import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Render + R2 production blueprint", () => {
  it("declares the selected Render resources without secret values", () => {
    const blueprintPath = resolve(root, "render.yaml");
    expect(existsSync(blueprintPath)).toBe(true);
    const blueprint = readFileSync(blueprintPath, "utf8");

    expect(blueprint).toContain("name: portal-web");
    expect(blueprint).toContain("name: portal-api");
    expect(blueprint).toContain("name: portal-worker");
    expect(blueprint).toContain("name: portal-sync-cron");
    expect(blueprint).toContain("type: keyvalue");
    expect(blueprint).toContain("name: portal-postgres");
    expect(blueprint).toContain("fromDatabase:");
    expect(blueprint).toContain("fromService:");
    expect(blueprint).toContain("sync: false");
    expect(blueprint).not.toMatch(/postgres(?:ql)?:\/\/[^\s"']+/i);
    expect(blueprint).not.toMatch(/(?:R2|SESSION|AUTH|DATABASE|REDIS)[^\n]*:\s*[^\n]*(?:secret|token|password|Bearer)/i);
  });

  it("keeps the R2 contract explicit and secret-free", () => {
    const docs = readFileSync(resolve(root, "docs/architecture/production-stack.md"), "utf8");
    for (const key of ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
      expect(docs).toContain(key);
    }
    expect(docs).toContain("Cloudflare R2");
    expect(docs).toContain("S3-compatible");
    expect(docs).not.toMatch(/(?:access[_-]?key|secret|token|password)\s*[:=]\s*[^`\s]+/i);
  });

  it("uses Render's externally injected port and host for web services", () => {
    const api = readFileSync(resolve(root, "apps/api/src/server.mjs"), "utf8");
    const web = readFileSync(resolve(root, "apps/web/src/server.mjs"), "utf8");
    expect(api).toContain('process.env.API_HOST || "127.0.0.1"');
    expect(web).toContain('process.env.HOST || "127.0.0.1"');
  });
});

