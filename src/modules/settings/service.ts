import {eq} from 'drizzle-orm';

import {db} from '@/db/client';
import {settings} from '@/db/schema';
import {appendAudit} from '@/modules/audit/service';
import {authorize, type PermissionActor} from '@/modules/permissions/service';
import {settingsSchema, type SettingsInput} from './schemas';

export async function updateSettings(
  actor: PermissionActor,
  rawInput: SettingsInput
) {
  authorize(actor, 'settings.manage.all');
  const input = settingsSchema.parse(rawInput);
  return db.transaction(async (tx) => {
    const [old] = await tx.select().from(settings).where(eq(settings.key, 'default'));
    const [saved] = await tx
      .insert(settings)
      .values({...input, key: 'default', updatedBy: actor.id, updatedAt: new Date()})
      .onConflictDoUpdate({
        target: settings.key,
        set: {...input, updatedBy: actor.id, updatedAt: new Date()}
      })
      .returning();
    await appendAudit(tx, {
      actorId: actor.id,
      entityType: 'settings',
      entityId: 1,
      action: 'UPDATE',
      oldValues: old ?? null,
      newValues: saved
    });
    return saved;
  });
}
