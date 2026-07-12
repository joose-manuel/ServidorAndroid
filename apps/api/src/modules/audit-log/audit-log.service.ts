import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditLogEntry, AuditEventType } from '@servidor/shared-types';

@Injectable()
export class AuditLogService {
  private readonly entries: AuditLogEntry[] = [];

  record(event: AuditEventType, ctx: { userId?: string; edgeNodeId?: string; ip?: string; userAgent?: string; metadata?: Record<string, unknown> }): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      event,
      userId: ctx.userId,
      edgeNodeId: ctx.edgeNodeId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: ctx.metadata,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  list(filter: { edgeNodeId?: string; userId?: string; event?: AuditEventType }): AuditLogEntry[] {
    return this.entries.filter(
      (e) =>
        (!filter.edgeNodeId || e.edgeNodeId === filter.edgeNodeId) &&
        (!filter.userId || e.userId === filter.userId) &&
        (!filter.event || e.event === filter.event),
    );
  }
}