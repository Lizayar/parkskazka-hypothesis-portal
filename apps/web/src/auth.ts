import { randomUUID } from "node:crypto";
import type { Principal } from "@portal/domain/auth/roles";
import type { SessionRecord } from "@portal/db/schema/auth";

export type SessionCookieOptions = {
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: "/";
};

export function createSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  };
}

export class InMemorySessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  create(principal: Principal, now = new Date(), ttlMs = 8 * 60 * 60 * 1000): SessionRecord {
    const record: SessionRecord = {
      id: randomUUID(),
      principal: {
        ...principal,
        roles: [...principal.roles],
        workspaceIds: [...principal.workspaceIds],
      },
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };
    this.sessions.set(record.id, record);
    return this.clone(record);
  }

  get(id: string, now = new Date()): SessionRecord | undefined {
    const record = this.sessions.get(id);
    if (!record) {
      return undefined;
    }
    if (Date.parse(record.expiresAt) <= now.getTime()) {
      this.sessions.delete(id);
      return undefined;
    }
    return this.clone(record);
  }

  revoke(id: string): void {
    this.sessions.delete(id);
  }

  revokeSubject(subjectId: string): void {
    for (const [id, record] of this.sessions) {
      if (record.principal.subjectId === subjectId) {
        this.sessions.delete(id);
      }
    }
  }

  private clone(record: SessionRecord): SessionRecord {
    return {
      ...record,
      principal: {
        ...record.principal,
        roles: [...record.principal.roles],
        workspaceIds: [...record.principal.workspaceIds],
      },
    };
  }
}

