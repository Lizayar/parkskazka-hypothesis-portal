import type { Principal, Role } from "./roles.js";

export const permissions = [
  "workspace.read",
  "workspace.manage",
  "hypothesis.read",
  "hypothesis.create",
  "hypothesis.edit",
  "hypothesis.approve",
  "hypothesis.decide",
  "campaign.read",
  "campaign.manage",
  "creative.read",
  "creative.manage",
  "integration.read",
  "integration.manage",
  "audit.read",
] as const;

export type Permission = (typeof permissions)[number];

export type WorkspaceResource = {
  kind: "workspace";
  workspaceId: string;
};

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN" as const;

  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "AuthorizationError";
  }
}

const rolePermissions: Record<Role, readonly Permission[]> = {
  owner: permissions,
  analyst: [
    "workspace.read",
    "hypothesis.read",
    "hypothesis.create",
    "hypothesis.edit",
    "campaign.read",
    "creative.read",
    "audit.read",
  ],
  marketer: [
    "workspace.read",
    "hypothesis.read",
    "hypothesis.create",
    "hypothesis.edit",
    "campaign.read",
    "creative.read",
    "creative.manage",
  ],
  reviewer: [
    "workspace.read",
    "hypothesis.read",
    "hypothesis.approve",
    "hypothesis.decide",
    "campaign.read",
    "creative.read",
    "audit.read",
  ],
  viewer: ["workspace.read", "hypothesis.read", "campaign.read", "creative.read"],
  service: ["campaign.read", "creative.read", "integration.read", "integration.manage"],
};

export function can(
  principal: Principal,
  permission: Permission,
  resource: WorkspaceResource,
): boolean {
  if (!principal.workspaceIds.includes(resource.workspaceId)) {
    return false;
  }

  return principal.roles.some((role) => rolePermissions[role].includes(permission));
}

export function requirePermission(
  principal: Principal,
  permission: Permission,
  resource: WorkspaceResource,
): void {
  if (!can(principal, permission, resource)) {
    throw new AuthorizationError();
  }
}

