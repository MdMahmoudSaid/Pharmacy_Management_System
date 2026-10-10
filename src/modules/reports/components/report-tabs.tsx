'use client';

import {Printer} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {useState, type ReactNode} from 'react';

import {ReportTable, type ReportColumn} from './report-table';

type ReportData = Awaited<ReturnType<typeof import('../queries').getReportData>>;
type Tab = 'sales' | 'expenses' | 'stock' | 'movements' | 'employees' | 'shifts';

const TABS = ['sales', 'expenses', 'stock', 'movements', 'employees', 'shifts'] as const;
const amountFormat = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

function Mru({value}: {value: string | number}) {
  return <bdi dir="ltr" className="mru">{amountFormat.format(Number(value))} <small>MRU</small></bdi>;
}

export function ReportTabs({data, canPrint}: {data: ReportData; canPrint: boolean}) {
  const t = useTranslations('Reports');
  const stockT = useTranslations('Stock');
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>('sales');
  const date = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nouakchott'});
  const separator = locale === 'ar' ? '، ' : ', ';
  const status = (value: string) => {
    const cancelled = value === 'CANCELLED';
    const open = value === 'OPEN';
    return (
      <span className={`status-pill${cancelled ? ' is-cancelled' : open ? ' is-open' : ''}`}>
        {t(`statuses.${value}` as 'statuses.COMPLETED')}
      </span>
    );
  };

  const tables: Record<Tab, {columns: ReportColumn[]; rows: ReactNode[][]}> = {
    sales: {
      columns: [{label: t('colMedicines')}, {label: t('colEmployee')}, {label: t('colDate')}, {label: t('status')}, {label: t('colAmount'), numeric: true}],
      rows: data.sales.map((sale) => [
        sale.items.map(({name, quantity}) => (quantity > 1 ? `${name} × ${quantity}` : name)).join(separator),
        <bdi key="who">{sale.operatorName}</bdi>,
        date.format(sale.createdAt),
        status(sale.status),
        <Mru key="total" value={sale.total} />
      ])
    },
    expenses: {
      columns: [{label: t('colCategory')}, {label: t('colDate')}, {label: t('status')}, {label: t('colAmount'), numeric: true}],
      rows: data.expenses.map((expense) => [
        expense.categoryName ?? expense.description ?? '',
        date.format(expense.occurredAt),
        status(expense.status),
        <Mru key="amount" value={expense.amount} />
      ])
    },
    stock: {
      columns: [{label: t('colMedicine')}, {label: t('colStock'), numeric: true}, {label: t('colPrice'), numeric: true}],
      rows: data.stock.map((medicine) => [
        medicine.name,
        stockT('stockCount', {count: medicine.currentStock}),
        <Mru key="price" value={medicine.sellingPrice} />
      ])
    },
    movements: {
      columns: [{label: t('colMedicine')}, {label: t('colType')}, {label: t('colDate')}, {label: t('colQuantity'), numeric: true}, {label: t('colBalance'), numeric: true}],
      rows: data.movements.map((movement) => [
        movement.medicineName,
        stockT(`types.${movement.type}`),
        date.format(movement.createdAt),
        <bdi key="qty" dir="ltr">{movement.quantityChange > 0 ? `+${movement.quantityChange}` : movement.quantityChange}</bdi>,
        movement.quantityAfter
      ])
    },
    employees: {
      columns: [{label: t('colName')}, {label: t('status')}],
      rows: data.employees.map((employee) => [
        <bdi key="name">{employee.name}</bdi>,
        <span key="status" className={`status-pill${employee.isActive ? '' : ' is-cancelled'}`}>{employee.isActive ? t('active') : t('inactive')}</span>
      ])
    },
    shifts: {
      columns: [{label: t('colEmployee')}, {label: t('colOpened')}, {label: t('colClosed')}, {label: t('status')}],
      rows: data.shifts.map((shift) => [
        <bdi key="who">{shift.userName}</bdi>,
        date.format(shift.openedAt),
        shift.closedAt ? date.format(shift.closedAt) : '—',
        status(shift.status)
      ])
    }
  };

  return (
    <section className="reports-panel">
      <div className="report-summary">
        <article><span>{t('salesTotal')}</span><strong><Mru value={data.summary.salesTotal} /></strong></article>
        <article><span>{t('expensesTotal')}</span><strong><Mru value={data.summary.expensesTotal} /></strong></article>
        <article><span>{t('netTotal')}</span><strong><Mru value={data.summary.netTotal} /></strong></article>
        <article><span>{t('stockUnits')}</span><strong>{data.stockUnits}</strong></article>
      </div>
      <div className="report-toolbar no-print">
        <div className="report-tabs" role="tablist">
          {TABS.map((key) => (
            <button type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)} key={key}>
              {t(key)}
            </button>
          ))}
        </div>
        {canPrint ? (
          <button type="button" className="secondary-action report-print" onClick={() => window.print()} aria-label={t('print')}>
            <Printer size={16} aria-hidden="true" /><span>{t('print')}</span>
          </button>
        ) : null}
      </div>
      <h2>{t(tab)}</h2>
      <ReportTable columns={tables[tab].columns} rows={tables[tab].rows} emptyText={t('empty')} />
    </section>
  );
}
