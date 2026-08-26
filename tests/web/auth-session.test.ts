import { describe, expect, it } from "vitest";
import {
  InMemorySessionStore,
  createSessionCookieOptions,
} from "@portal/web/auth";

describe("server-side session boundary", () => {
  it("uses an opaque secure cookie without provider tokens", () => {
    const options = createSessionCookieOptions();

    expect(options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("revokes a session without exposing its stored principal to the browser", () => {
    const store = new InMemorySessionStore();
    const session = store.create({
      subjectId: "github|42",
      provider: "github",
      roles: ["owner"],
      workspaceIds: ["workspace-1"],
    });

    expect(store.get(session.id)?.principal.subjectId).toBe("github|42");
    expect(store.get(session.id)?.providerToken).toBeUndefined();

    store.revoke(session.id);
    expect(store.get(session.id)).toBeUndefined();
  });
});

