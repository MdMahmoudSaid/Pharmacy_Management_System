'use client';

import {useTranslations} from 'next-intl';
import {useActionState} from 'react';

import {
  cancelExpenseAction,
  correctExpenseAction,
  type ExpenseActionState
} from '../actions';

type ExpenseRow = {
  expense: {
    id: number;
    amount: string;
    description: string;
    status: 'ACTIVE' | 'CANCELLED';
    shiftId: number;
    occurredAt: Date;
    operatorId: number;
  };
  operatorName: string;
};

function ExpenseActions({
  row,
  locale,
  canCorrect,
  canCancel
}: {
  row: ExpenseRow;
  locale: 'ar' | 'fr';
  canCorrect: boolean;
  canCancel: boolean;
}) {
  const t = useTranslations('Expenses');
  const [correctState, correctAction, correcting] = useActionState<
    ExpenseActionState,
    FormData
  >(correctExpenseAction, undefined);
  const [cancelState, cancelAction, cancelling] = useActionState<
    ExpenseActionState,
    FormData
  >(cancelExpenseAction, undefined);
  if (row.expense.status !== 'ACTIVE') return null;
  return (
    <div className="expense-actions">
      {canCorrect ? (
        <details>
          <summary>{t('correct')}</summary>
          <form action={correctAction} data-testid={`correct-expense-${row.expense.id}`}>
            <input type="hidden" name="id" value={row.expense.id} />
            <input type="hidden" name="locale" value={locale} />
            <input name="amount" defaultValue={row.expense.amount} inputMode="decimal" required />
            <input name="description" defaultValue={row.expense.description} required />
            <input name="reason" placeholder={t('reason')} required />
            {correctState && !correctState.ok ? <small>{t(`errors.${correctState.code}`)}</small> : null}
            {correctState?.ok ? <small>{t('corrected')}</small> : null}
            <button className="secondary-action" disabled={correcting}>{t('saveCorrection')}</button>
          </form>
        </details>
      ) : null}
      {canCancel ? (
        <form action={cancelAction} className="cancel-expense-form">
          <input type="hidden" name="id" value={row.expense.id} />
          <input type="hidden" name="locale" value={locale} />
          <input name="reason" placeholder={t('cancelReason')} required />
          {cancelState && !cancelState.ok ? <small>{t(`errors.${cancelState.code}`)}</small> : null}
          <button className="danger-action" disabled={cancelling}>{t('cancel')}</button>
        </form>
      ) : null}
    </div>
  );
}

export function ExpenseList({
  rows,
  locale,
  actorId,
  canCorrectAll,
  canCancelAll,
  canCorrectOwn,
  canCancelOwn
}: {
  rows: ExpenseRow[];
  locale: 'ar' | 'fr';
  actorId: number;
  canCorrectAll: boolean;
  canCancelAll: boolean;
  canCorrectOwn: boolean;
  canCancelOwn: boolean;
}) {
  const t = useTranslations('Expenses');
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nouakchott'
  });
  return (
    <section className="expense-list">
      <h2>{t('history')}</h2>
      {rows.length === 0 ? <p>{t('empty')}</p> : null}
      {rows.map((row) => (
        <article key={row.expense.id} className="expense-row">
          <div><strong>{row.expense.description}</strong><small>{row.operatorName} · {format.format(row.expense.occurredAt)} · Shift #{row.expense.shiftId}</small></div>
          <b>{row.expense.amount} MRU</b>
          <span className={row.expense.status === 'ACTIVE' ? 'status-active' : 'status-archived'}>
            {row.expense.status === 'ACTIVE' ? t('active') : t('cancelled')}
          </span>
          <ExpenseActions
            row={row}
            locale={locale}
            canCorrect={canCorrectAll || (canCorrectOwn && row.expense.operatorId === actorId)}
            canCancel={canCancelAll || (canCancelOwn && row.expense.operatorId === actorId)}
          />
        </article>
      ))}
    </section>
  );
}
