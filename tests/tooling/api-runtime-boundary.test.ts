import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("API runtime boundary", () => {
  it("keeps the HTTP entry as an explicit JS bridge without secret-bearing imports", () => {
    const source = readFileSync(resolve(process.cwd(), "apps/api/src/server.mjs"), "utf8");

    expect(source).not.toContain("@portal/");
    expect(source).toContain('process.env.PORTAL_READ_BACKEND || "fixture"');
    expect(source).toContain("POSTGRES_READ_ROUTE_NOT_MAPPED");
    expect(source).not.toContain("DATABASE_URL");
    expect(source).not.toContain("AUTH_GITHUB_SECRET");
  });
});

