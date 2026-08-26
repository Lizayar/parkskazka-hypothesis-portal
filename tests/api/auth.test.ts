import { describe, expect, it } from "vitest";
import { authorize } from "@portal/api/plugins/auth";
import { readAuthConfig } from "@portal/config/auth-config";
import { InMemoryAuditRepository } from "@portal/db/repositories/audit-repository";

describe("provider authorization", () => {
  it("allows only an immutable subject ID from the configured GitHub allowlist", () => {
    const config = readAuthConfig({
      AUTH_ALLOWED_GITHUB_IDS: "github|42,github|99",
    });

    const result = authorize(
      { provider: "github", subjectId: "github|42", email: "owner@example.test" },
      config,
    );

    expect(result.kind).toBe("authorized");
    if (result.kind === "authorized") {
      expect(result.principal.subjectId).toBe("github|42");
      expect(result.principal.provider).toBe("github");
      expect(result.principal).not.toHaveProperty("accessToken");
    }
  });

  it("returns generic denial for an unknown provider subject", () => {
    const config = readAuthConfig({ AUTH_ALLOWED_GITHUB_IDS: "github|42" });
    const result = authorize({ provider: "github", subjectId: "github|404" }, config);

    expect(result).toEqual({ kind: "denied", code: "UNAUTHORIZED" });
  });

  it("keeps audit events append-only and strips credential-shaped metadata", () => {
    const repository = new InMemoryAuditRepository();

    repository.append({
      action: "auth.login.denied",
      actorSubjectId: "anonymous",
      requestId: "request-1",
      reason: "subject_not_allowlisted",
      metadata: {
        accessToken: "should-not-be-stored",
        password: "should-not-be-stored",
        surface: "github",
      },
    });

    const [event] = repository.list();
    expect(event.metadata).toEqual({ surface: "github" });
    expect(repository).not.toHaveProperty("update");
    expect(repository).not.toHaveProperty("delete");
  });
});

