import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import Link from 'next/link';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {can} from '@/modules/permissions/service';
import {Receipt} from '@/modules/sales/components/receipt';
import {SaleDetailActions} from '@/modules/sales/components/sale-detail';
import {getSaleDetail} from '@/modules/sales/service';
import {getPharmacyName} from '@/modules/settings/queries';

export default async function SaleDetailPage({
  params
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  let detail;
  try {
    detail = await getSaleDetail(actor, Number(id));
  } catch {
    notFound();
  }
  const [t, pharmacyName] = await Promise.all([
    getTranslations('Sales'),
    getPharmacyName()
  ]);
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nouakchott'
  });

  return (
    <main className="page-content sale-detail-page">
      <header className="page-heading no-print">
        <p>{t('detailKicker')}</p>
        <h1 dir="ltr">{detail.sale.saleNumber}</h1>
        <Link href={`/${locale}/sales`}>{t('backToSales')}</Link>
      </header>
      <div className="sale-detail-grid">
        <Receipt
          pharmacyName={pharmacyName}
          sale={detail.sale}
          operatorName={detail.operatorName}
          items={detail.items}
          locale={locale}
        />
        <aside className="sale-meta no-print">
          <h2>{t('information')}</h2>
          <dl>
            <div><dt>{t('employee')}</dt><dd>{detail.operatorName}</dd></div>
            <div><dt>{t('createdAt')}</dt><dd>{format.format(detail.sale.createdAt)}</dd></div>
            <div><dt>{t('createdBy')}</dt><dd>{detail.createdByName ?? '—'}</dd></div>
            <div><dt>{t('updatedBy')}</dt><dd>{detail.updatedByName ?? '—'}</dd></div>
            <div><dt>{t('shift')}</dt><dd>#{detail.shift?.id ?? detail.sale.shiftId}</dd></div>
            <div><dt>{t('status')}</dt><dd>{detail.sale.status === 'COMPLETED' ? t('completed') : t('cancelled')}</dd></div>
          </dl>
          <h2>{t('auditTimeline')}</h2>
          <ol className="audit-timeline">
            {detail.audit.map((entry) => (
              <li key={entry.id}>
                <strong>{t(`auditActions.${entry.action}`)}</strong>
                <span>{entry.actorName} · {format.format(entry.createdAt)}</span>
                {entry.reason ? <p>{entry.reason}</p> : null}
              </li>
            ))}
          </ol>
        </aside>
      </div>
      <SaleDetailActions
        saleId={detail.sale.id}
        locale={locale}
        initialItems={detail.items}
        canCorrect={can(actor, 'sales.correct.own', detail.sale.operatorId)}
        canCancel={can(actor, 'sales.cancel.own', detail.sale.operatorId)}
        isCompleted={detail.sale.status === 'COMPLETED'}
      />
    </main>
  );
}
