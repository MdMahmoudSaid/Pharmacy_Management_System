'use client';

import {useTranslations} from 'next-intl';
import {useActionState} from 'react';

import {type EmployeeActionState, updateEmployeeAction} from '../actions';

export function EmployeeEditForm({
  employee,
  locale
}: {
  employee: {id: number; name: string; phoneE164: string};
  locale: 'ar' | 'fr';
}) {
  const t = useTranslations('Employees');
  const [state, action, pending] = useActionState<EmployeeActionState, FormData>(
    updateEmployeeAction,
    undefined
  );
  return (
    <details className="permission-editor">
      <summary>{t('edit')}</summary>
      <form action={action}>
        <input type="hidden" name="id" value={employee.id} />
        <input type="hidden" name="locale" value={locale} />
        <label>
          <span>{t('name')}</span>
          <input name="name" defaultValue={employee.name} required />
        </label>
        <label>
          <span>{t('phone')}</span>
          <input
            name="phone"
            defaultValue={employee.phoneE164.slice(4)}
            inputMode="numeric"
            pattern="[234][0-9]{7}"
            minLength={8}
            maxLength={8}
            required
          />
        </label>
        {state && !state.ok ? (
          <p className="form-error" data-result={state.code}>
            {t(`errors.${state.code}`)}
          </p>
        ) : null}
        <button className="secondary-action" disabled={pending}>
          {t('save')}
        </button>
      </form>
    </details>
  );
}
