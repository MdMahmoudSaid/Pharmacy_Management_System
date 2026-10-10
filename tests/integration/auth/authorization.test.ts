import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {permissions, userPermissions} from '@/db/schema';
import {loadPermissionActor} from '@/modules/permissions/service';
import {createUser, resetDatabase} from '../../factories/database';

describe('stored authorization grants', () => {
  beforeAll(migrateDatabase);
  beforeEach(resetDatabase);

  it('loads only the employee permissions stored in the fixed catalog', async () => {
    const admin = await createUser({role: 'ADMIN'});
    const employee = await createUser();
    await db.insert(permissions).values({
      key: 'sales.correct.own',
      domain: 'sales',
      action: 'correct',
      scope: 'OWN'
    });
    await db.insert(userPermissions).values({
      userId: employee.id,
      permissionKey: 'sales.correct.own',
      grantedBy: admin.id
    });

    const actor = await loadPermissionActor(employee.id);

    expect(actor.permissions).toEqual(['sales.correct.own']);
  });
});
