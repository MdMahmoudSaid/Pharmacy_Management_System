import {eq, sql} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {auditLogs} from '@/db/schema';
import {appendAudit} from '@/modules/audit/service';
import {createUser, resetDatabase} from '../../factories/database';

describe('append-only audit log', () => {
  beforeAll(migrateDatabase);
  beforeEach(resetDatabase);

  it('inserts an event in the caller transaction as the application role', async () => {
    const actor = await createUser();

    await db.transaction(async (tx) => {
      await tx.execute(sql`set local role pharmacy_app`);
      await appendAudit(tx, {
        actorId: actor.id,
        entityType: 'users',
        entityId: actor.id,
        action: 'CREATE',
        newValues: {name: actor.name}
      });
    });

    const entries = await db.select().from(auditLogs);
    expect(entries).toHaveLength(1);
  });

  it.each(['update', 'delete'] as const)(
    'denies %s through the application database role',
    async (operation) => {
      const actor = await createUser();
      const [entry] = await db
        .insert(auditLogs)
        .values({
          actorId: actor.id,
          entityType: 'users',
          entityId: actor.id,
          action: 'CREATE'
        })
        .returning();

      await expect(
        db.transaction(async (tx) => {
          await tx.execute(sql`set local role pharmacy_app`);
          if (operation === 'update') {
            await tx
              .update(auditLogs)
              .set({reason: 'forbidden'})
              .where(eq(auditLogs.id, entry.id));
          } else {
            await tx.delete(auditLogs).where(eq(auditLogs.id, entry.id));
          }
        })
      ).rejects.toMatchObject({cause: {code: '42501'}});
    }
  );
});
