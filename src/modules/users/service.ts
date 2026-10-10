import {and, eq, isNull} from 'drizzle-orm';

import {db} from '@/db/client';
import {sessions, users} from '@/db/schema';
import {hashPin} from '@/modules/auth/service';

export async function replaceUserPin(userId: number, pin: string): Promise<void> {
  const pinHash = await hashPin(pin);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({pinHash, updatedAt: new Date()})
      .where(eq(users.id, userId));
    await tx
      .update(sessions)
      .set({revokedAt: new Date()})
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  });
}
