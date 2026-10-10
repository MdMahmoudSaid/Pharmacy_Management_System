import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {eq} from 'drizzle-orm';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {auditLogs, settings} from '@/db/schema';
import {updateSettings} from '@/modules/settings/service';
import type {PermissionActor} from '@/modules/permissions/service';
import {createUser, resetDatabase} from '../../factories/database';

describe('settings', () => {
  beforeAll(migrateDatabase);
  beforeEach(resetDatabase);
  it('requires permission and audits the pharmacy name change', async () => {
    const user = await createUser();
    const denied: PermissionActor = {id: user.id, role: 'EMPLOYEE', isActive: true, permissions: []};
    await expect(updateSettings(denied, {pharmacyName: 'صيدلية الشفاء', defaultLocale: 'ar'})).rejects.toMatchObject({code: 'FORBIDDEN'});
    const actor = {...denied, permissions: ['settings.manage.all'] as const};
    await updateSettings(actor, {pharmacyName: 'صيدلية الشفاء', defaultLocale: 'ar'});
    expect(await db.select().from(settings)).toHaveLength(1);
    const [audit] = await db.select().from(auditLogs).where(eq(auditLogs.entityType, 'settings'));
    expect(audit).toMatchObject({action: 'UPDATE', actorId: actor.id});
  });
});
