export type OAuthProviderConfig = {
  issuer: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectUris: readonly string[];
  scopes: readonly string[];
  allowedSubjectIdsEnv: string;
};

export type SecurityContract = OAuthProviderConfig & {
  authentication: "oauth_oidc_only";
  passwordLogin: false;
  provider: "github";
  allowlistKey: "immutable_provider_subject_id";
  browserTokenExposure: "none";
  repositoryWriteScope: false;
};

const securityContract: SecurityContract = {
  authentication: "oauth_oidc_only",
  passwordLogin: false,
  provider: "github",
  issuer: "https://github.com",
  clientIdEnv: "AUTH_GITHUB_ID",
  clientSecretEnv: "AUTH_GITHUB_SECRET",
  redirectUris: ["http://localhost:3000/api/auth/callback/github"],
  scopes: ["openid", "profile", "email"],
  allowedSubjectIdsEnv: "AUTH_ALLOWED_GITHUB_IDS",
  allowlistKey: "immutable_provider_subject_id",
  browserTokenExposure: "none",
  repositoryWriteScope: false,
};

export function readSecurityContract(): SecurityContract {
  return {
    ...securityContract,
    redirectUris: [...securityContract.redirectUris],
    scopes: [...securityContract.scopes],
  };
}

