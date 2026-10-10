import {describe, expect, it} from 'vitest';

import ar from '../../../messages/ar.json';
import fr from '../../../messages/fr.json';
import {AUDIT_FIELDS, auditChanges, referencedIds} from '@/modules/audit/format';
import {PERMISSION_KEYS} from '@/modules/permissions/catalog';

describe('audit formatting', () => {
  it('lists only changed fields with typed values', () => {
    expect(
      auditChanges(
        {name: 'Advil', code: 'A1', sellingPrice: '10.00'},
        {name: 'Advil', code: 'A1', sellingPrice: '12.00'}
      )
    ).toEqual([
      {field: 'sellingPrice', old: {kind: 'money', amount: '10.00'}, new: {kind: 'money', amount: '12.00'}}
    ]);
  });

  it('shows created values without an old side and hides unknown fields', () => {
    expect(auditChanges(null, {role: 'EMPLOYEE', pinHash: 'secret'})).toEqual([
      {field: 'role', old: undefined, new: {kind: 'label', key: 'EMPLOYEE'}}
    ]);
  });

  it('turns permission lists into added and removed entries', () => {
    expect(
      auditChanges(
        {permissions: ['sales.view.own', 'stock.view.all']},
        {permissions: ['sales.view.own', 'audit.view.all']}
      )
    ).toEqual([
      {field: 'permissionsAdded', new: {kind: 'permissions', keys: ['audit.view.all']}},
      {field: 'permissionsRemoved', old: {kind: 'permissions', keys: ['stock.view.all']}}
    ]);
  });

  it('collects medicine and user references', () => {
    expect(
      referencedIds([{medicineId: 3}, {items: [{medicineId: 4, quantity: 1}]}, {userId: 7}])
    ).toEqual({medicineIds: [3, 4], userIds: [7], categoryIds: []});
  });

  it('has a translated label for every permission and audit field', () => {
    for (const messages of [ar, fr]) {
      for (const key of PERMISSION_KEYS) {
        expect(messages.Employees.permissionLabels).toHaveProperty(key.replaceAll('.', '_'));
      }
      for (const field of [...AUDIT_FIELDS, 'permissionsAdded', 'permissionsRemoved']) {
        expect(messages.Audit.fields).toHaveProperty(field);
      }
    }
  });
});
