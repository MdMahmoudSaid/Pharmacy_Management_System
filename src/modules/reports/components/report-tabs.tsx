'use client';

import {Printer} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useState} from 'react';

import {ReportTable} from './report-table';

type ReportData = Awaited<ReturnType<typeof import('../queries').getReportData>>;

export function ReportTabs({data, canPrint}: {data: ReportData; canPrint: boolean}) {
  const t = useTranslations('Reports');
  const [tab, setTab] = useState<'sales' | 'expenses' | 'stock' | 'movements' | 'employees' | 'shifts'>('sales');
  const tabs = ['sales', 'expenses', 'stock', 'movements', 'employees', 'shifts'] as const;
  const rows = {
    sales: data.sales.map((row) => [row.saleNumber, row.status, row.total]),
    expenses: data.expenses.map((row) => [row.description, row.status, row.amount]),
    stock: data.stock.map((row) => [row.name, row.currentStock, row.sellingPrice]),
    movements: data.movements.map((row) => [row.type, row.quantityChange, row.quantityAfter]),
    employees: data.employees.map((row) => [row.name, row.isActive ? t('active') : t('inactive')]),
    shifts: data.shifts.map((row) => [row.id, row.status, row.userId])
  };
  return (
    <section className="reports-panel">
      <div className="report-summary">
        <article><span>{t('salesTotal')}</span><strong>{data.summary.salesTotal} MRU</strong></article>
        <article><span>{t('expensesTotal')}</span><strong>{data.summary.expensesTotal} MRU</strong></article>
        <article><span>{t('netTotal')}</span><strong>{data.summary.netTotal} MRU</strong></article>
        <article><span>{t('stockUnits')}</span><strong>{data.stockUnits}</strong></article>
      </div>
      <div className="report-tabs no-print">
        {tabs.map((key) => <button type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)} key={key}>{t(key)}</button>)}
        {canPrint ? <button type="button" onClick={() => window.print()}><Printer size={16} />{t('print')}</button> : null}
      </div>
      <h2>{t(tab)}</h2>
      <ReportTable headings={[t('reference'), t('status'), t('value')]} rows={rows[tab]} />
    </section>
  );
}
