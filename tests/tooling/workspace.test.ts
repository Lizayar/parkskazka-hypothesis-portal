import { describe, expect, it } from "vitest";
import { loadPublicEnv } from "@portal/config/public-env";

describe("workspace foundation", () => {
  it("exposes only browser-safe public configuration", () => {
    const env = loadPublicEnv({
      NEXT_PUBLIC_APP_NAME: "Hypothesis Portal",
      AUTH_GITHUB_SECRET: undefined,
      DATABASE_URL: "postgres://server-only",
    });

    expect(env).toEqual({ appName: "Hypothesis Portal" });
    expect(JSON.stringify(env)).not.toContain("AUTH_GITHUB_SECRET");
    expect(JSON.stringify(env)).not.toContain("DATABASE_URL");
  });
});

