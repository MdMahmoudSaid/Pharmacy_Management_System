'use client';

import {KeyRound, Archive, ArchiveRestore} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState, useState} from 'react';

import {ConfirmForm} from '@/components/confirm-form';
import {
  archiveEmployeeAction,
  resetEmployeePinAction,
  restoreEmployeeAction,
  type EmployeeActionState
} from '../actions';

function ActiveStateForm({employeeId, name, locale, active}: {
  employeeId: number;
  name: string;
  locale: 'ar' | 'fr';
  active: boolean;
}) {
  const t = useTranslations('Employees');
  const [state, formAction, pending] = useActionState<EmployeeActionState, FormData>(
    active ? archiveEmployeeAction : restoreEmployeeAction,
    undefined
  );
  return (
    <ConfirmForm
      action={formAction}
      className="security-card"
      message={t(active ? 'archiveConfirm' : 'restoreConfirm', {name})}
    >
      <div className="security-card-heading">
        {active ? <Archive size={18} aria-hidden="true" /> : <ArchiveRestore size={18} aria-hidden="true" />}
        <strong>{active ? t('archive') : t('restore')}</strong>
      </div>
      <p>{active ? t('archiveHint') : t('restoreHint')}</p>
      <input type="hidden" name="id" value={employeeId} />
      <input type="hidden" name="locale" value={locale} />
      <button disabled={pending} className={active ? 'danger-action' : 'secondary-action'}>
        {active ? t('archive') : t('restore')}
      </button>
      {state && !state.ok ? (
        <p className="form-error" role="alert" data-result={state.code}>{t(`errors.${state.code}`)}</p>
      ) : null}
    </ConfirmForm>
  );
}

function ResetPinForm({employeeId, name, locale}: {employeeId: number; name: string; locale: 'ar' | 'fr'}) {
  const t = useTranslations('Employees');
  const [state, resetAction, pending] = useActionState<EmployeeActionState, FormData>(
    resetEmployeePinAction,
    undefined
  );
  const [formKey, setFormKey] = useState(0);
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) setFormKey((key) => key + 1);
  }
  return (
    <ConfirmForm
      key={formKey}
      action={resetAction}
      className="security-card"
      message={t('resetPinConfirm', {name})}
    >
      <div className="security-card-heading">
        <KeyRound size={18} aria-hidden="true" />
        <strong>{t('resetPin')}</strong>
      </div>
      <p>{t('resetPinHint')}</p>
      <input type="hidden" name="id" value={employeeId} />
      <input type="hidden" name="locale" value={locale} />
      <input
        name="pin"
        type="password"
        inputMode="numeric"
        pattern="[0-9]{4}"
        maxLength={4}
        autoComplete="new-password"
        placeholder={t('newPin')}
        aria-label={t('newPin')}
        dir="ltr"
        required
      />
      <button disabled={pending} className="secondary-action">{t('resetPin')}</button>
      {state && !state.ok ? (
        <p className="form-error" role="alert" data-result={state.code}>{t(`errors.${state.code}`)}</p>
      ) : null}
      {state?.ok ? <p className="form-success" role="status">{t('pinChanged')}</p> : null}
    </ConfirmForm>
  );
}

export function EmployeeActions({employeeId, name, locale, active, canChangeActive, canResetPin}: {
  employeeId: number;
  name: string;
  locale: 'ar' | 'fr';
  active: boolean;
  canChangeActive: boolean;
  canResetPin: boolean;
}) {
  return (
    <div className="security-cards">
      {canResetPin && active ? <ResetPinForm employeeId={employeeId} name={name} locale={locale} /> : null}
      {canChangeActive ? (
        <ActiveStateForm key={String(active)} employeeId={employeeId} name={name} locale={locale} active={active} />
      ) : null}
    </div>
  );
}
