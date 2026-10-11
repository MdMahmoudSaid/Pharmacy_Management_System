'use client';

import {useTranslations} from 'next-intl';
import {useActionState, useState} from 'react';

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
  const [checked, setChecked] = useState(() => new Set(selected));
  const toggle = (keys: readonly string[], on: boolean) =>
    setChecked((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });

  return (
    <form action={action} className="permission-editor">
      <input type="hidden" name="id" value={employeeId} />
      <input type="hidden" name="locale" value={locale} />
      <div className="permission-groups">
        {Object.entries(grouped).map(([domain, permissions]) => {
          const count = permissions.filter((key) => checked.has(key)).length;
          const all = count === permissions.length;
          return (
            <fieldset key={domain}>
              <legend>
                <span>{t(`domains.${domain}`)}</span>
                <small dir="ltr">{count}/{permissions.length}</small>
                <button type="button" className="link-action" onClick={() => toggle(permissions, !all)}>
                  {all ? t('clearAll') : t('selectAll')}
                </button>
              </legend>
              {permissions.map((permission) => (
                <label key={permission} title={permission}>
                  <input
                    type="checkbox"
                    name="permissions"
                    value={permission}
                    checked={checked.has(permission)}
                    onChange={(event) => toggle([permission], event.target.checked)}
                  />
                  <span>{t(`permissionLabels.${permission.replaceAll('.', '_')}`)}</span>
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>
      <div className="permission-footer">
        <button className="primary-action" disabled={pending}>
          {t('savePermissions')}
        </button>
        {state && !state.ok ? (
          <p className="form-error" role="alert" data-result={state.code}>
            {t(`errors.${state.code}`)}
          </p>
        ) : null}
        {state?.ok ? <p className="form-success" role="status">{t('permissionsSaved')}</p> : null}
      </div>
    </form>
  );
}
