import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {listAuditLogs} from '@/modules/audit/queries';
import {AuditTable} from '@/modules/audit/components/audit-table';
import {requireSession} from '@/modules/auth/session';

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
      to: to ? new Date(`${to}T00:00:00.000Z`) : undefined,
      action: action || undefined,
      entityType: entityType || undefined
    })
  ]);
  return (
    <main className="page-content">
      <header className="page-heading"><p>{t('kicker')}</p><h1>{t('title')}</h1><span>{t('subtitle')}</span></header>
      <form className="report-filters no-print"><input type="date" name="from" defaultValue={from} /><input type="date" name="to" defaultValue={to} /><input name="action" defaultValue={action} placeholder={t('action')} /><input name="entityType" defaultValue={entityType} placeholder={t('entity')} /><button className="secondary-action">{t('filter')}</button></form>
      <AuditTable rows={rows} locale={locale} />
    </main>
  );
}
