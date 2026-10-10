'use client';

import {useTranslations} from 'next-intl';
import {useActionState} from 'react';

import {createExpenseAction, type ExpenseActionState} from '../actions';

export function ExpenseForm({shiftId, locale}: {shiftId: number; locale: 'ar' | 'fr'}) {
  const t = useTranslations('Expenses');
  const [state, action, pending] = useActionState<ExpenseActionState, FormData>(
    createExpenseAction,
    undefined
  );
  return (
    <form action={action} className="entity-form expense-form" data-testid="expense-form">
      <h2>{t('new')}</h2>
      <input type="hidden" name="shiftId" value={shiftId} />
      <input type="hidden" name="locale" value={locale} />
      <label>{t('amount')}<input name="amount" inputMode="decimal" placeholder="0.00" required /></label>
      <label>{t('description')}<input name="description" required /></label>
      {state && !state.ok ? <p className="form-error">{t(`errors.${state.code}`)}</p> : null}
      {state?.ok ? <p className="form-success">{t('created')}</p> : null}
      <button className="primary-action" disabled={pending}>{t('save')}</button>
    </form>
  );
}
