import {and, desc, eq, gte, lt} from 'drizzle-orm';

import {db} from '@/db/client';
import {auditLogs, users} from '@/db/schema';
import {authorize, type PermissionActor} from '@/modules/permissions/service';

export async function listAuditLogs(
  actor: PermissionActor,
  filters: {from?: Date; to?: Date; action?: string; entityType?: string} = {}
) {
  authorize(actor, 'audit.view.all');
  return db
    .select({audit: auditLogs, actorName: users.name})
    .from(auditLogs)
    .innerJoin(users, eq(auditLogs.actorId, users.id))
    .where(
      and(
        filters.from ? gte(auditLogs.createdAt, filters.from) : undefined,
        filters.to ? lt(auditLogs.createdAt, filters.to) : undefined,
        filters.action ? eq(auditLogs.action, filters.action as typeof auditLogs.action.enumValues[number]) : undefined,
        filters.entityType ? eq(auditLogs.entityType, filters.entityType) : undefined
      )
    )
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(300);
}
