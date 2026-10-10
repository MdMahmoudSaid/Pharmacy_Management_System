import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {DataState} from '@/components/data-state';
import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {ExpenseForm} from '@/modules/expenses/components/expense-form';
import {ExpenseList} from '@/modules/expenses/components/expense-list';
import {listExpenses} from '@/modules/expenses/service';
import {can} from '@/modules/permissions/service';
import {requireActiveShift} from '@/modules/shifts/service';

const stringValue = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : '';

export default async function ExpensesPage({
  params,
  searchParams
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  const query = await searchParams;
  const t = await getTranslations('Expenses');
  const canCreate = can(actor, 'expenses.create.own', actor.id);
  const canView = can(actor, 'expenses.view.own', actor.id);
  let shift = null;
  if (canCreate) {
    try {
      shift = await requireActiveShift(actor.id);
    } catch {
      shift = null;
    }
  }
  const from = stringValue(query.from);
  const to = stringValue(query.to);
  const operatorId = Number(stringValue(query.operatorId)) || undefined;
  const shiftId = Number(stringValue(query.shiftId)) || undefined;
  const rows = canView
    ? await listExpenses(actor, {
        from: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
        to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
        operatorId,
        shiftId
      })
    : [];

  return (
    <main className="page-content">
      <header className="page-heading">
        <p>{t('kicker')}</p>
        <h1>{t('title')}</h1>
        <span>{t('subtitle')}</span>
      </header>
      <div className="expenses-layout">
        {shift ? (
          <ExpenseForm shiftId={shift.id} locale={locale} />
        ) : canCreate ? (
          <DataState title={t('shiftRequired')} description={t('shiftRequiredText')} />
        ) : null}
        {canView ? (
          <div>
            <form className="expense-filters">
              <label>{t('from')}<input type="date" name="from" defaultValue={from} /></label>
              <label>{t('to')}<input type="date" name="to" defaultValue={to} /></label>
              <label>{t('employeeId')}<input type="number" name="operatorId" min="1" defaultValue={operatorId} /></label>
              <label>{t('shiftId')}<input type="number" name="shiftId" min="1" defaultValue={shiftId} /></label>
              <button className="secondary-action">{t('filter')}</button>
            </form>
            <ExpenseList
              rows={rows}
              locale={locale}
              actorId={actor.id}
              canCorrectAll={can(actor, 'expenses.correct.all')}
              canCancelAll={can(actor, 'expenses.cancel.all')}
              canCorrectOwn={can(actor, 'expenses.correct.own', actor.id)}
              canCancelOwn={can(actor, 'expenses.cancel.own', actor.id)}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
