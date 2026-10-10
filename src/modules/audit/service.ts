import type {DbTransaction} from '@/db/client';
import {auditLogs} from '@/db/schema';

export type AuditEvent = Omit<
  typeof auditLogs.$inferInsert,
  'id' | 'createdAt'
>;

export async function appendAudit(
  tx: DbTransaction,
  event: AuditEvent
): Promise<void> {
  await tx.insert(auditLogs).values(event);
}
