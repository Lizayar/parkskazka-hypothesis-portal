import { describe, expect, it } from "vitest";
import { requirePermission } from "@portal/domain/auth/permissions";
import { principalWithRole } from "@portal/domain/auth/roles";

const workspace = { kind: "workspace" as const, workspaceId: "workspace-1" };

describe("RBAC permission matrix", () => {
  it("allows a viewer to read but not approve a hypothesis", () => {
    const viewer = principalWithRole("viewer", ["workspace-1"]);

    expect(() => requirePermission(viewer, "hypothesis.read", workspace)).not.toThrow();
    expect(() => requirePermission(viewer, "hypothesis.approve", workspace)).toThrow("FORBIDDEN");
  });

  it("allows a reviewer to approve within an assigned workspace", () => {
    const reviewer = principalWithRole("reviewer", ["workspace-1"]);

    expect(() => requirePermission(reviewer, "hypothesis.approve", workspace)).not.toThrow();
  });

  it("denies a role when the resource belongs to another workspace", () => {
    const analyst = principalWithRole("analyst", ["workspace-1"]);

    expect(() =>
      requirePermission(analyst, "campaign.read", {
        kind: "workspace",
        workspaceId: "workspace-2",
      }),
    ).toThrow("FORBIDDEN");
  });
});

