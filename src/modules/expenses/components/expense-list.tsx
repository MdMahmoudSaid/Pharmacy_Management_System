'use client';

import {useTranslations} from 'next-intl';
import {useActionState} from 'react';

import {ConfirmForm} from '@/components/confirm-form';
import type {ExpenseCategory} from '../categories';
import {
  cancelExpenseAction,
  correctExpenseAction,
  type ExpenseActionState
} from '../actions';
import {CategoryPicker} from './category-picker';

type ExpenseRow = {
  expense: {
    id: number;
    amount: string;
    categoryId: number | null;
    description: string | null;
    status: 'ACTIVE' | 'CANCELLED';
    shiftId: number;
    occurredAt: Date;
    operatorId: number;
  };
  operatorName: string;
  categoryName: string | null;
};

const amountFormat = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

function ExpenseActions({row, locale, categories, canCreateCategory, canCorrect, canCancel}: {
  row: ExpenseRow;
  locale: 'ar' | 'fr';
  categories: ExpenseCategory[];
  canCreateCategory: boolean;
  canCorrect: boolean;
  canCancel: boolean;
}) {
  const t = useTranslations('Expenses');
  const [correctState, correctAction, correcting] = useActionState<ExpenseActionState, FormData>(correctExpenseAction, undefined);
  const [cancelState, cancelAction, cancelling] = useActionState<ExpenseActionState, FormData>(cancelExpenseAction, undefined);
  if (row.expense.status !== 'ACTIVE' || (!canCorrect && !canCancel)) return null;
  return (
    <div className="expense-actions">
      {canCorrect ? (
        <details>
          <summary>{t('correct')}</summary>
          <form action={correctAction} className="entry-form" data-testid={`correct-expense-${row.expense.id}`}>
            <input type="hidden" name="id" value={row.expense.id} />
            <input type="hidden" name="locale" value={locale} />
            <div className="entry-field">
              <span>{t('category')}</span>
              <CategoryPicker categories={categories} defaultValue={row.expense.categoryId} canCreate={canCreateCategory} locale={locale} />
            </div>
            <label><span>{t('amountMru')}</span><input name="amount" defaultValue={row.expense.amount} inputMode="decimal" dir="ltr" required /></label>
            <label className="entry-field-wide"><span>{t('note')}</span><textarea name="description" defaultValue={row.expense.description ?? ''} rows={1} /></label>
            <label className="entry-field-wide"><span>{t('reason')}</span><input name="reason" required /></label>
            <div className="entry-footer">
              <button className="secondary-action" disabled={correcting}>{t('saveCorrection')}</button>
              {correctState && !correctState.ok ? <small className="form-error">{t(`errors.${correctState.code}`)}</small> : null}
              {correctState?.ok ? <small className="form-success">{t('corrected')}</small> : null}
            </div>
          </form>
        </details>
      ) : null}
      {canCancel ? (
        <ConfirmForm action={cancelAction} className="cancel-expense-form" message={t('cancelConfirm')}>
          <input type="hidden" name="id" value={row.expense.id} />
          <input type="hidden" name="locale" value={locale} />
          <input name="reason" placeholder={t('cancelReason')} aria-label={t('cancelReason')} required />
          <button className="danger-action" disabled={cancelling}>{t('cancel')}</button>
          {cancelState && !cancelState.ok ? <small className="form-error">{t(`errors.${cancelState.code}`)}</small> : null}
        </ConfirmForm>
      ) : null}
    </div>
  );
}

export function ExpenseList({rows, locale, actorId, categories, canCreateCategory, canCorrectAll, canCancelAll, canCorrectOwn, canCancelOwn}: {
  rows: ExpenseRow[];
  locale: 'ar' | 'fr';
  actorId: number;
  categories: ExpenseCategory[];
  canCreateCategory: boolean;
  canCorrectAll: boolean;
  canCancelAll: boolean;
  canCorrectOwn: boolean;
  canCancelOwn: boolean;
}) {
  const t = useTranslations('Expenses');
  const format = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nouakchott'});
  return (
    <section className="expense-list" aria-labelledby="expense-history-title">
      <h2 id="expense-history-title">{t('history')}</h2>
      {!rows.length ? <p className="expense-empty">{t('empty')}</p> : null}
      {rows.map((row) => {
        const cancelled = row.expense.status === 'CANCELLED';
        const title = row.categoryName ?? row.expense.description ?? t('uncategorized');
        const note = row.categoryName ? row.expense.description : null;
        return (
          <article key={row.expense.id} className={cancelled ? 'expense-row is-cancelled' : 'expense-row'}>
            <div className="expense-row-main">
              <strong>{title}{cancelled ? <em>{t('cancelled')}</em> : null}</strong>
              <small><bdi>{row.operatorName}</bdi> · <bdi>{format.format(row.expense.occurredAt)}</bdi></small>
              {note ? <p>{note}</p> : null}
            </div>
            <b dir="ltr">−{amountFormat.format(Number(row.expense.amount))} MRU</b>
            <ExpenseActions
              row={row}
              locale={locale}
              categories={categories}
              canCreateCategory={canCreateCategory}
              canCorrect={canCorrectAll || (canCorrectOwn && row.expense.operatorId === actorId)}
              canCancel={canCancelAll || (canCancelOwn && row.expense.operatorId === actorId)}
            />
          </article>
        );
      })}
    </section>
  );
}
