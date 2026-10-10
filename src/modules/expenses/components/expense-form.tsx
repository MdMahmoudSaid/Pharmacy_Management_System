'use client';

import {ChevronDown} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState, useState} from 'react';

import type {ExpenseCategory} from '../categories';
import {createExpenseAction, type ExpenseActionState} from '../actions';
import {CategoryPicker} from './category-picker';

export function ExpenseForm({shiftId, locale, categories, canCreateCategory}: {
  shiftId: number;
  locale: 'ar' | 'fr';
  categories: ExpenseCategory[];
  canCreateCategory: boolean;
}) {
  const t = useTranslations('Expenses');
  const [state, action, pending] = useActionState<ExpenseActionState, FormData>(createExpenseAction, undefined);
  // A new key after each success clears the form; a failed attempt keeps what was typed.
  const [formKey, setFormKey] = useState(0);
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) setFormKey((key) => key + 1);
  }

  return (
    <details className="form-collapse">
      <summary><span>{t('addExpense')}</span><ChevronDown size={20} aria-hidden="true" /></summary>
      <form key={formKey} action={action} className="entry-form" data-testid="expense-form">
        <input type="hidden" name="shiftId" value={shiftId} />
        <input type="hidden" name="locale" value={locale} />
        <div className="entry-field">
          <span>{t('category')}</span>
          <CategoryPicker categories={categories} canCreate={canCreateCategory} locale={locale} />
        </div>
        <label>
          <span>{t('amountMru')}</span>
          <input name="amount" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" placeholder="0.00" dir="ltr" required />
        </label>
        <label className="entry-field-wide">
          <span>{t('note')}</span>
          <textarea name="description" maxLength={2000} rows={1} />
        </label>
        <div className="entry-footer">
          <button className="primary-action" disabled={pending}>{t('addExpense')}</button>
          {state && !state.ok ? <p className="form-error" role="alert">{t(`errors.${state.code}`)}</p> : null}
          {state?.ok ? <p className="form-success" role="status">{t('created')}</p> : null}
        </div>
      </form>
    </details>
  );
}
