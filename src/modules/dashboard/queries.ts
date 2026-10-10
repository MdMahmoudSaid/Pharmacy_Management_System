import {desc, eq} from 'drizzle-orm';

import {db} from '@/db/client';
import {auditLogs, shifts} from '@/db/schema';
import {nouakchottRange} from '@/lib/time';
import type {PermissionActor} from '@/modules/permissions/service';
import {getReportData} from '@/modules/reports/queries';

export async function getDashboardSummary(actor: PermissionActor, now = new Date()) {
  const report = await getReportData(actor, nouakchottRange('today', now));
  const [openShifts, recentActivity] = await Promise.all([
    db.select().from(shifts).where(eq(shifts.status, 'OPEN')),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(8)
  ]);
  return {...report, openShifts, recentActivity};
}
