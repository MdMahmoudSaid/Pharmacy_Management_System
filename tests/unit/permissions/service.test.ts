import {describe, expect, it} from 'vitest';

import {PERMISSION_KEYS, type PermissionKey} from '@/modules/permissions/catalog';
import {authorize, type PermissionActor} from '@/modules/permissions/service';

const employeeWith = (...permissions: PermissionKey[]): PermissionActor => ({
  id: 7,
  role: 'EMPLOYEE',
  isActive: true,
  permissions
});

describe('permission service', () => {
  it('does not treat own scope as all scope', () => {
    const actor = employeeWith('sales.correct.own');

    expect(() =>
      authorize(actor, 'sales.correct.own', actor.id)
    ).not.toThrow();
    expect(() => authorize(actor, 'sales.correct.own', 99)).toThrow(
      'FORBIDDEN'
    );
  });

  it('allows an all-scope grant to satisfy its own-scope counterpart', () => {
    const actor = employeeWith('sales.correct.all');
    expect(() => authorize(actor, 'sales.correct.own', 99)).not.toThrow();
  });

  it('allows an active admin to use every catalog permission', () => {
    const admin: PermissionActor = {
      id: 1,
      role: 'ADMIN',
      isActive: true,
      permissions: []
    };

    for (const permission of PERMISSION_KEYS) {
      expect(() => authorize(admin, permission, 99)).not.toThrow();
    }
  });

  it('denies every permission to a disabled user', () => {
    const actor = {...employeeWith(...PERMISSION_KEYS), isActive: false};

    for (const permission of PERMISSION_KEYS) {
      expect(() => authorize(actor, permission, actor.id)).toThrow('FORBIDDEN');
    }
  });
});
