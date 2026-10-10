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
    <form action={action} className="entry-form">
      <input type="hidden" name="id" value={employee.id} />
      <input type="hidden" name="locale" value={locale} />
      <label>
        <span>{t('name')}</span>
        <input name="name" defaultValue={employee.name} minLength={2} maxLength={120} required />
      </label>
      <label>
        <span>{t('phone')}</span>
        <span className="prefixed-input" dir="ltr">
          <b>+222</b>
          <input
            name="phone"
            defaultValue={employee.phoneE164.slice(4)}
            inputMode="numeric"
            pattern="[234][0-9]{7}"
            minLength={8}
            maxLength={8}
            required
          />
        </span>
      </label>
      <div className="entry-footer">
        <button className="primary-action" disabled={pending}>{t('save')}</button>
        {state && !state.ok ? (
          <p className="form-error" role="alert" data-result={state.code}>
            {t(`errors.${state.code}`)}
          </p>
        ) : null}
        {state?.ok ? <p className="form-success" role="status">{t('saved')}</p> : null}
      </div>
    </form>
  );
}
