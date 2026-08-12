import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("API runtime strategy", () => {
  it("documents and validates the explicit JS bridge runtime", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const strategy = readFileSync(
      resolve(process.cwd(), "docs/architecture/api-runtime-strategy.md"),
      "utf8",
    );
    const entry = readFileSync(resolve(process.cwd(), "apps/api/src/server.mjs"), "utf8");

    expect(packageJson.scripts?.["api:runtime:check"]).toBe("node tests/tooling/api-runtime-check.mjs");
    expect(strategy).toContain("JS bridge");
    expect(strategy).toContain("@portal/*");
    expect(entry).not.toContain("@portal/");
    expect(entry).not.toContain("DATABASE_URL");
  });
});

