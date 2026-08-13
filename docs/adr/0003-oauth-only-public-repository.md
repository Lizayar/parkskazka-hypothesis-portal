# ADR 0003: OAuth-only access for a public repository

- Status: accepted
- Date: 2026-08-12
- Deciders: Park Skazka project owner, Codex

## Context

The portal repository is public and will aggregate advertising data and hypothesis decisions. The initial request included a login/password, but storing or implementing a shared password would create a high-risk credential in a public-project workflow and would not provide scoped identity, revocation or auditability.

## Decision

Use OAuth/OIDC only for portal authentication. GitHub is the first provider. Access is granted by an allowlist of immutable provider subject IDs managed outside Git. The first scope set is `openid`, `profile`, `email`; repository write scopes are not required for portal login. Sessions are server-side and opaque, with HttpOnly/Secure/SameSite cookies, rotation, CSRF/state/nonce validation and emergency revoke.

The supplied password is not used, persisted or transported by the portal. No password login, password reset, universal admin password or password seed exists.

## Consequences

### Positive

- No shared secret is embedded in public code or fixtures.
- Individual provider identity supports deny-by-default RBAC and audit events.
- Provider access can be revoked without changing application code.
- Scope is limited to identity claims for portal login.

### Trade-offs

- The owner must complete OAuth/MFA and configure a provider application per environment.
- Local development needs an allowlisted provider subject or a mocked OAuth provider in tests.
- Production callback domains and secret-manager integration are deployment work, not repository defaults.

## Rejected alternatives

- Shared `admin/password` login — rejected: credential leakage, no individual audit and weak revocation.
- Username/email allowlist — rejected: mutable and non-canonical identifiers.
- GitHub repository token as portal login — rejected: wrong trust boundary and unnecessary repository scope.
- Password auth plus OAuth fallback — rejected: creates a weaker bypass around the intended control.

## Follow-up

- Task 2: safe environment names, CI secret scan and local stack.
- Task 3: OAuth callback, session rotation, RBAC, audit and revoke.
- Phase 0: register local/staging/production GitHub OAuth apps and exact redirect URIs.

