import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("deployment acceptance contract", () => {
  it("requires a secret-free API manifest and acceptance command", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "deploy/api-runtime.manifest.json"), "utf8"),
    ) as Record<string, unknown>;
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(manifest).toMatchObject({
      service: "api",
      entry: "apps/api/src/server.mjs",
      healthPath: "/health",
      readOnly: true,
    });
    expect(manifest).toHaveProperty("readPaths", ["/api/summary", "/api/hypotheses", "/api/explorer"]);
    expect(manifest).toHaveProperty("externalSecretRefs");
    expect(manifest).not.toHaveProperty("secretValues");
    expect(JSON.stringify(manifest)).not.toContain("postgres://");
    expect(packageJson.scripts?.["deploy:acceptance"]).toBe("node tests/tooling/deployment-acceptance.mjs");
  });

  it("requires CI to run deployment acceptance before browser smoke", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");

    expect(workflow).toContain("pnpm deploy:acceptance");
    expect(workflow.indexOf("pnpm deploy:acceptance")).toBeLessThan(
      workflow.indexOf("browser-smoke:"),
    );
  });
});

