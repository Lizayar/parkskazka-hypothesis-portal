import { describe, expect, it } from "vitest";
import { loadServerEnv } from "@portal/config/env";

describe("read backend environment", () => {
  it("defaults local runtime to fixture without exposing server secrets", () => {
    const env = loadServerEnv({ NODE_ENV: "local", DATABASE_URL: "postgres://server-only" });

    expect(env.portalReadBackend).toBe("fixture");
  });

  it("accepts postgres backend as an explicit server-side choice", () => {
    const env = loadServerEnv({ NODE_ENV: "staging", PORTAL_READ_BACKEND: "postgres" });

    expect(env.portalReadBackend).toBe("postgres");
  });

  it("rejects unsupported backend names", () => {
    expect(() => loadServerEnv({ PORTAL_READ_BACKEND: "mysql" })).toThrow("INVALID_READ_BACKEND");
  });
});

