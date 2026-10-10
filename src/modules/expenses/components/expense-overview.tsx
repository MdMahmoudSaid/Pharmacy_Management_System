import {ReceiptText} from 'lucide-react';
import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

import {EXPENSE_PRESETS, type ExpensePeriod} from '../period';

const amountFormat = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

export async function ExpensePeriodFilter({locale, period}: {locale: 'ar' | 'fr'; period: ExpensePeriod}) {
  const t = await getTranslations('Expenses');
  const href = (preset: string) => (preset === 'all' ? `/${locale}/expenses` : `/${locale}/expenses?period=${preset}`);
  return (
    <div className="expense-period no-print">
      <nav className="expense-period-pills" aria-label={t('periodLabel')}>
        {[...EXPENSE_PRESETS, 'custom' as const].map((preset) => (
          <Link key={preset} href={href(preset)} scroll={false} aria-current={period.preset === preset ? 'page' : undefined}>
            {t(preset)}
          </Link>
        ))}
      </nav>
      {period.preset === 'custom' ? (
        <form className="period-custom" action={`/${locale}/expenses`}>
          <input type="hidden" name="period" value="custom" />
          <label><span>{t('from')}</span><input type="date" name="from" defaultValue={period.from ?? ''} required /></label>
          <label><span>{t('to')}</span><input type="date" name="to" defaultValue={period.to ?? ''} required /></label>
          <button className="primary-action">{t('apply')}</button>
        </form>
      ) : null}
    </div>
  );
}

export async function ExpenseTotalCard({total, count}: {total: string; count: number}) {
  const t = await getTranslations('Expenses');
  return (
    <section className="expense-total" aria-label={t('total')}>
      <span className="expense-total-icon" aria-hidden="true"><ReceiptText size={26} /></span>
      <div className="expense-total-body">
        <span>{t('total')}</span>
        <strong dir="ltr">{amountFormat.format(Number(total))} <small>MRU</small></strong>
      </div>
      <span className="expense-total-count">{t('count', {count})}</span>
    </section>
  );
}
