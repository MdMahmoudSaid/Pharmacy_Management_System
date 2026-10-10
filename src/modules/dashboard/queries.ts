import {and, desc, eq} from 'drizzle-orm';

import {db} from '@/db/client';
import {auditLogs, shifts} from '@/db/schema';
import {nouakchottRange} from '@/lib/time';
import {can, type PermissionActor} from '@/modules/permissions/service';
import {getReportData} from '@/modules/reports/queries';

export async function getDashboardSummary(actor: PermissionActor, now = new Date()) {
  const report = await getReportData(actor, nouakchottRange('today', now));
  const mayViewAllShifts = can(actor, 'shifts.view.all');
  const mayViewOwnShifts = can(actor, 'shifts.view.own', actor.id);
  const mayViewAudit = can(actor, 'audit.view.all');
  const [openShifts, recentActivity] = await Promise.all([
    mayViewAllShifts
      ? db.select().from(shifts).where(eq(shifts.status, 'OPEN'))
      : mayViewOwnShifts
        ? db.select().from(shifts).where(and(eq(shifts.status, 'OPEN'), eq(shifts.userId, actor.id)))
        : Promise.resolve([]),
    mayViewAudit
      ? db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(8)
      : Promise.resolve([])
  ]);
  return {...report, openShifts, recentActivity};
}
