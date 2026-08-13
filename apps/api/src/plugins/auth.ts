import type { AuthConfig } from "@portal/config/auth-config";
import type { Principal } from "@portal/domain/auth/roles";

export type AuthRequest = {
  provider: string;
  subjectId: string;
  email?: string;
};

export type AuthResult =
  | { kind: "authorized"; principal: Principal }
  | { kind: "denied"; code: "UNAUTHORIZED" };

export function authorize(request: AuthRequest, config: AuthConfig): AuthResult {
  if (
    request.provider !== config.provider ||
    !config.allowedSubjectIds.includes(request.subjectId)
  ) {
    return { kind: "denied", code: "UNAUTHORIZED" };
  }

  return {
    kind: "authorized",
    principal: {
      subjectId: request.subjectId,
      provider: "github",
      ...(request.email ? { email: request.email } : {}),
      roles: [config.defaultRole],
      workspaceIds: [...config.defaultWorkspaceIds],
    },
  };
}

