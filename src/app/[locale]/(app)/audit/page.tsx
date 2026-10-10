import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {auditAction} from '@/db/schema';
import {auditReferenceNames, listAuditLogs} from '@/modules/audit/queries';
import {AuditTable} from '@/modules/audit/components/audit-table';
import {requireSession} from '@/modules/auth/session';

const ENTITY_TYPES = ['users', 'medicines', 'sales', 'expenses', 'expense_categories', 'stock_receipts', 'shifts', 'settings'] as const;
const text = (value: string | string[] | undefined) => typeof value === 'string' ? value : '';

export default async function AuditPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  const query = await searchParams;
  const from = text(query.from);
  const to = text(query.to);
  const action = text(query.action);
  const entityType = text(query.entityType);
  const [t, rows] = await Promise.all([
    getTranslations('Audit'),
    listAuditLogs(actor, {
      from: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
      // Inclusive end date: stop at the start of the following day.
      to: to ? new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000) : undefined,
      action: action || undefined,
      entityType: entityType || undefined
    })
  ]);
  const names = await auditReferenceNames(rows);
  return (
    <main className="page-content">
      <header className="page-heading"><p>{t('kicker')}</p><h1>{t('title')}</h1><span>{t('subtitle')}</span></header>
      <form className="report-filters filter-form no-print">
        <label><span>{t('from')}</span><input type="date" name="from" defaultValue={from} /></label>
        <label><span>{t('to')}</span><input type="date" name="to" defaultValue={to} /></label>
        <label><span>{t('action')}</span><select name="action" defaultValue={action}><option value="">{t('allActions')}</option>{auditAction.enumValues.map((value) => <option key={value} value={value}>{t(`actions.${value}`)}</option>)}</select></label>
        <label><span>{t('entity')}</span><select name="entityType" defaultValue={entityType}><option value="">{t('allEntities')}</option>{ENTITY_TYPES.map((value) => <option key={value} value={value}>{t(`entities.${value}`)}</option>)}</select></label>
        <button className="primary-action">{t('filter')}</button>
      </form>
      <AuditTable rows={rows} names={names} locale={locale} />
    </main>
  );
}
