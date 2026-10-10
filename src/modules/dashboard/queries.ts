import {and, desc, eq} from 'drizzle-orm';

import {db} from '@/db/client';
import {auditLogs, shifts} from '@/db/schema';
import {nouakchottRange} from '@/lib/time';
import type {PermissionActor} from '@/modules/permissions/service';
import {getReportData} from '@/modules/reports/queries';

export async function getDashboardSummary(actor: PermissionActor, now = new Date()) {
  const report = await getReportData(actor, nouakchottRange('today', now));
  const all = actor.role === 'ADMIN' || actor.permissions.includes('reports.view.all');
  const [openShifts, recentActivity] = await Promise.all([
    db.select().from(shifts).where(and(eq(shifts.status, 'OPEN'), !all ? eq(shifts.userId, actor.id) : undefined)),
    db.select().from(auditLogs).where(!all ? eq(auditLogs.actorId, actor.id) : undefined).orderBy(desc(auditLogs.createdAt)).limit(8)
  ]);
  return {...report, openShifts, recentActivity};
}
