'use client';

import {useTranslations} from 'next-intl';
import {useActionState} from 'react';

import {
  setEmployeePermissionsAction,
  type EmployeeActionState
} from '../actions';
import {PERMISSION_KEYS, type PermissionKey} from '@/modules/permissions/catalog';

const grouped = PERMISSION_KEYS.reduce<Record<string, PermissionKey[]>>(
  (groups, permission) => {
    const [domain] = permission.split('.');
    (groups[domain] ??= []).push(permission);
    return groups;
  },
  {}
);

export function PermissionEditor({
  employeeId,
  selected,
  locale
}: {
  employeeId: number;
  selected: readonly string[];
  locale: 'ar' | 'fr';
}) {
  const t = useTranslations('Employees');
  const [state, action, pending] = useActionState<EmployeeActionState, FormData>(
    setEmployeePermissionsAction,
    undefined
  );

  return (
    <details className="permission-editor">
      <summary>{t('permissions')}</summary>
      <form action={action}>
        <input type="hidden" name="id" value={employeeId} />
        <input type="hidden" name="locale" value={locale} />
        {Object.entries(grouped).map(([domain, permissions]) => (
          <fieldset key={domain}>
            <legend>{t(`domains.${domain}`)}</legend>
            {permissions.map((permission) => (
              <label key={permission}>
                <input
                  type="checkbox"
                  name="permissions"
                  value={permission}
                  defaultChecked={selected.includes(permission)}
                />
                <span>{permission}</span>
              </label>
            ))}
          </fieldset>
        ))}
        <label>
          <span>{t('reason')}</span>
          <input name="reason" required />
        </label>
        {state && !state.ok ? (
          <p className="form-error" data-result={state.code}>
            {t(`errors.${state.code}`)}
          </p>
        ) : null}
        <button className="secondary-action" disabled={pending}>
          {t('savePermissions')}
        </button>
      </form>
    </details>
  );
}
