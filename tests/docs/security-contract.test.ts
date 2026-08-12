import { describe, expect, it } from "vitest";
import { readSecurityContract } from "@portal/config/security-contract";

describe("public repository security contract", () => {
  it("forbids password authentication and requires OAuth scopes", () => {
    const contract = readSecurityContract();

    expect(contract.authentication).toBe("oauth_oidc_only");
    expect(contract.passwordLogin).toBe(false);
    expect(contract.provider).toBe("github");
    expect(contract.scopes).toEqual(["openid", "profile", "email"]);
    expect(contract.allowedSubjectIdsEnv).toBe("AUTH_ALLOWED_GITHUB_IDS");
  });
});

