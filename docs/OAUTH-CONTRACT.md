# OAuth/OIDC контракт портала

Статус: accepted for Task 1, implementation of callback/session deferred to Task 3.

## Обязательные решения

- Первый identity provider — GitHub OAuth/OIDC.
- Аутентификация — только OAuth/OIDC; password login, password reset и универсальный bootstrap-пароль отсутствуют.
- Allowlist строится по immutable GitHub provider subject ID, а не по display name, email или username.
- Первый набор scopes ограничен `openid`, `profile`, `email`. Repository scopes для входа в портал не запрашиваются.
- OAuth client ID и client secret читаются только backend из secret manager/environment. Они никогда не попадают в browser bundle, URL, log, issue, fixture или публичный seed.
- Access token provider-а используется только серверным auth boundary и не возвращается JavaScript-коду браузера.

## Runtime contract

Кодовый контракт находится в `packages/config/src/security-contract.ts` и возвращает:

```ts
{
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
}
```

Production redirect URI не зашивается до выбора домена. Она регистрируется в отдельном production OAuth application и проходит exact-match проверку; wildcard и user-controlled redirect URI запрещены.

## Login flow (Task 3)

1. Backend создаёт cryptographically random `state`, `nonce` и короткоживущий flow record.
2. Backend redirect-ит пользователя на GitHub с exact callback URI и scopes из контракта.
3. Callback принимает только ожидаемые `state`, provider code и зарегистрированный redirect URI.
4. Backend обменивает code на provider response server-to-server и проверяет subject, issuer, audience/ client ID, nonce и обязательные claims.
5. Subject сравнивается с `AUTH_ALLOWED_GITHUB_IDS`. При отсутствии subject — generic denial без раскрытия причины.
6. Backend создаёт rotated server-side session в HttpOnly, Secure, SameSite cookie. Provider token не сериализуется в cookie и не отдаётся frontend.
7. Sign-in, denial, logout, revoke и role changes записываются в audit log с request ID, actor subject и reason code без credential values.

## Session and revoke boundaries

- Session identifier — opaque random value; данные сессии хранятся на сервере.
- Login и privilege change ротируют session ID; старый ID немедленно инвалидируется.
- Logout удаляет текущую сессию и отзывает server-side session record.
- Emergency revoke инвалидирует все сессии subject-а и создаёт audit event.
- CSRF защита обязательна для state-changing routes; GET callback не считается разрешением на mutation.

## Environment names (values are never committed)

```text
APP_BASE_URL
AUTH_GITHUB_ID
AUTH_GITHUB_SECRET
AUTH_ALLOWED_GITHUB_IDS
SESSION_ENCRYPTION_KEY
```

`AUTH_ALLOWED_GITHUB_IDS` — comma-separated immutable provider IDs, управляемые через secret manager или deployment environment. Display names не являются источником авторизации.

## Не входит в Task 1

- OAuth callback route и session implementation.
- Роли, workspace/brand/source-account scopes и audit repository.
- Production domain, OAuth application registration и deployment secrets.

