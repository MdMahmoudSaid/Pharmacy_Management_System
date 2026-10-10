'use client';

import {useTranslations} from 'next-intl';
import {useActionState} from 'react';

import {
  archiveEmployeeAction,
  resetEmployeePinAction,
  restoreEmployeeAction,
  type EmployeeActionState
} from '../actions';

function ActionForm({
  action,
  employeeId,
  locale,
  active
}: {
  action: typeof archiveEmployeeAction;
  employeeId: number;
  locale: 'ar' | 'fr';
  active: boolean;
}) {
  const t = useTranslations('Employees');
  const [state, formAction, pending] = useActionState<
    EmployeeActionState,
    FormData
  >(action, undefined);
  return (
    <form action={formAction} className="inline-sensitive-form">
      <input type="hidden" name="id" value={employeeId} />
      <input type="hidden" name="locale" value={locale} />
      <input name="reason" placeholder={t('reason')} required />
      {state && !state.ok ? <small data-result={state.code}>{state.code}</small> : null}
      <button disabled={pending} className={active ? 'danger-action' : 'secondary-action'}>
        {active ? t('archive') : t('restore')}
      </button>
    </form>
  );
}

export function EmployeeActions({
  employeeId,
  locale,
  active,
  canChangeActive,
  canResetPin
}: {
  employeeId: number;
  locale: 'ar' | 'fr';
  active: boolean;
  canChangeActive: boolean;
  canResetPin: boolean;
}) {
  const t = useTranslations('Employees');
  const [state, resetAction, pending] = useActionState<
    EmployeeActionState,
    FormData
  >(resetEmployeePinAction, undefined);
  return (
    <div className="employee-sensitive-actions">
      {canChangeActive ? (
        <ActionForm
          action={active ? archiveEmployeeAction : restoreEmployeeAction}
          employeeId={employeeId}
          locale={locale}
          active={active}
        />
      ) : null}
      {canResetPin ? (
        <form action={resetAction} className="inline-sensitive-form">
          <input type="hidden" name="id" value={employeeId} />
          <input type="hidden" name="locale" value={locale} />
          <input
            name="pin"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder={t('newPin')}
            required
          />
          <input name="reason" placeholder={t('reason')} required />
          {state && !state.ok ? <small data-result={state.code}>{state.code}</small> : null}
          <button disabled={pending} className="secondary-action">
            {t('resetPin')}
          </button>
        </form>
      ) : null}
    </div>
  );
}
