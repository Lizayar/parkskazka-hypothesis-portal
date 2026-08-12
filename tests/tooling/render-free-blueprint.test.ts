import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("free Render preview blueprint", () => {
  it("uses only free-compatible resource types and plans", () => {
    const blueprint = readFileSync(resolve(process.cwd(), "render.free.yaml"), "utf8");

    expect(blueprint).toContain("name: portal-web-free");
    expect(blueprint).toContain("name: portal-api-free");
    expect(blueprint).toContain("name: portal-kv-free");
    expect(blueprint).toContain("name: portal-postgres-free");
    expect(blueprint).toContain("plan: free");
    expect(blueprint).toContain("persistenceMode: off");
    expect(blueprint).not.toContain("type: worker");
    expect(blueprint).not.toContain("type: cron");
    expect(blueprint).not.toContain("plan: starter");
    expect(blueprint).not.toContain("plan: basic-256mb");
  });

  it("documents the intentional free-tier limitations", () => {
    const docs = readFileSync(resolve(process.cwd(), "docs/architecture/production-stack.md"), "utf8");
    expect(docs).toContain("render.free.yaml");
    expect(docs).toContain("30 дней");
    expect(docs).toContain("не выполняет автоматическую синхронизацию");
  });
});

