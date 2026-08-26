import { readSecurityContract } from "./security-contract.js";

export type AuthEnvironment = Readonly<Record<string, string | undefined>>;

export type AuthConfig = {
  provider: "github";
  issuer: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectUris: readonly string[];
  scopes: readonly string[];
  allowedSubjectIdsEnv: string;
  allowedSubjectIds: readonly string[];
  defaultRole: "viewer";
  defaultWorkspaceIds: readonly string[];
};

function splitList(value: string | undefined): readonly string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readAuthConfig(environment: AuthEnvironment = process.env): AuthConfig {
  const contract = readSecurityContract();

  return {
    provider: contract.provider,
    issuer: contract.issuer,
    clientIdEnv: contract.clientIdEnv,
    clientSecretEnv: contract.clientSecretEnv,
    redirectUris: [...contract.redirectUris],
    scopes: [...contract.scopes],
    allowedSubjectIdsEnv: contract.allowedSubjectIdsEnv,
    allowedSubjectIds: splitList(environment[contract.allowedSubjectIdsEnv]),
    defaultRole: "viewer",
    defaultWorkspaceIds: splitList(environment.AUTH_DEFAULT_WORKSPACE_IDS),
  };
}

