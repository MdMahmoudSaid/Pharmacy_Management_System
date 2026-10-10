import Decimal from 'decimal.js';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {DataState} from '@/components/data-state';
import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {canCreateExpenseCategory, listExpenseCategories} from '@/modules/expenses/categories';
import {ExpenseForm} from '@/modules/expenses/components/expense-form';
import {ExpenseList} from '@/modules/expenses/components/expense-list';
import {ExpensePeriodFilter, ExpenseTotalCard} from '@/modules/expenses/components/expense-overview';
import {parseExpensePeriod} from '@/modules/expenses/period';
import {listExpenses} from '@/modules/expenses/service';
import {can} from '@/modules/permissions/service';
import {requireActiveShift} from '@/modules/shifts/service';

const stringValue = (value: string | string[] | undefined) =>
  typeof value === 'string' ? value : undefined;

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
  const period = parseExpensePeriod({
    period: stringValue(query.period),
    from: stringValue(query.from),
    to: stringValue(query.to)
  });
  const [shift, categories, rows] = await Promise.all([
    canCreate ? requireActiveShift(actor.id).catch(() => null) : null,
    canCreate || canView ? listExpenseCategories() : [],
    canView ? listExpenses(actor, period.range) : []
  ]);
  const active = rows.filter(({expense}) => expense.status === 'ACTIVE');
  const total = active.reduce((sum, {expense}) => sum.plus(expense.amount), new Decimal(0)).toFixed(2);
  const canCreateCategory = canCreateExpenseCategory(actor);

  return (
    <main className="page-content expenses-page">
      <header className="page-heading">
        <p>{t('kicker')}</p>
        <h1>{t('title')}</h1>
        <span>{t('subtitle')}</span>
      </header>
      {canView ? (
        <>
          <ExpensePeriodFilter locale={locale} period={period} />
          <ExpenseTotalCard total={total} count={active.length} />
        </>
      ) : null}
      <p className="expense-intro">{t('intro')}</p>
      {shift ? (
        <ExpenseForm shiftId={shift.id} locale={locale} categories={categories} canCreateCategory={canCreateCategory} />
      ) : canCreate ? (
        <DataState title={t('shiftRequired')} description={t('shiftRequiredText')} />
      ) : null}
      {canView ? (
        <ExpenseList
          rows={rows}
          locale={locale}
          actorId={actor.id}
          categories={categories}
          canCreateCategory={canCreateCategory}
          canCorrectAll={can(actor, 'expenses.correct.all')}
          canCancelAll={can(actor, 'expenses.cancel.all')}
          canCorrectOwn={can(actor, 'expenses.correct.own', actor.id)}
          canCancelOwn={can(actor, 'expenses.cancel.own', actor.id)}
        />
      ) : null}
    </main>
  );
}
