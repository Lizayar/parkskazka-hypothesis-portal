import { randomUUID } from "node:crypto";
import type { AuditEvent, AuditEventInput } from "../schema/auth.js";

export interface AuditRepository {
  append(event: AuditEventInput): AuditEvent;
  list(): readonly AuditEvent[];
}

const credentialKey = /(token|secret|password|cookie|authorization|credential)/i;

function safeMetadata(metadata: AuditEventInput["metadata"]): Readonly<Record<string, string>> | undefined {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata).filter(([key]) => !credentialKey.test(key));
  return Object.fromEntries(entries);
}

function clone(event: AuditEvent): AuditEvent {
  return {
    ...event,
    ...(event.metadata ? { metadata: { ...event.metadata } } : {}),
  };
}

export class InMemoryAuditRepository implements AuditRepository {
  private readonly events: AuditEvent[] = [];

  append(event: AuditEventInput): AuditEvent {
    const stored: AuditEvent = {
      id: event.id ?? randomUUID(),
      action: event.action,
      actorSubjectId: event.actorSubjectId,
      requestId: event.requestId,
      ...(event.reason ? { reason: event.reason } : {}),
      createdAt: event.createdAt ?? new Date().toISOString(),
      ...(event.metadata ? { metadata: safeMetadata(event.metadata) } : {}),
    };

    this.events.push(stored);
    return clone(stored);
  }

  list(): readonly AuditEvent[] {
    return this.events.map(clone);
  }
}

