export const roles = ["owner", "analyst", "marketer", "reviewer", "viewer", "service"] as const;

export type Role = (typeof roles)[number];

export type Principal = {
  subjectId: string;
  provider: "github";
  email?: string;
  roles: readonly Role[];
  workspaceIds: readonly string[];
};

export function principalWithRole(
  role: Role,
  workspaceIds: readonly string[],
  subjectId = "test-subject",
): Principal {
  return {
    subjectId,
    provider: "github",
    roles: [role],
    workspaceIds: [...workspaceIds],
  };
}

