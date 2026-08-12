import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CI browser smoke gate", () => {
  it("keeps the local smoke fallback and an explicit Playwright availability gate", () => {
    const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");

    expect(workflow).toContain("browser-smoke:");
    expect(workflow).toContain("PLAYWRIGHT_AVAILABLE");
    expect(workflow).toContain("tests/smoke/local-services-smoke.mjs");
    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toContain("token:");
  });
});

