import type { Principal } from "@portal/domain/auth/roles";

export type SessionRecord = {
  id: string;
  principal: Principal;
  createdAt: string;
  expiresAt: string;
  /** Deliberately impossible: provider access tokens never cross the session boundary. */
  providerToken?: never;
};

export type AuditEvent = {
  id: string;
  action: string;
  actorSubjectId: string;
  requestId: string;
  reason?: string;
  createdAt: string;
  metadata?: Readonly<Record<string, string>>;
};

export type AuditEventInput = Omit<AuditEvent, "id" | "createdAt"> &
  Partial<Pick<AuditEvent, "id" | "createdAt">>;

