import {ArrowLeft, ArrowRight} from 'lucide-react';
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
  const [t, nav, settingsName] = await Promise.all([
    getTranslations('Sales'),
    getTranslations('Navigation'),
    getPharmacyName()
  ]);
  // The settings name wins once the owner has set one; until then the receipt uses the site name.
  const pharmacyName = settingsName && settingsName !== 'Pharmacy' ? settingsName : nav('brand');
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nouakchott'
  });
  const completed = detail.sale.status === 'COMPLETED';
  const Back = locale === 'ar' ? ArrowRight : ArrowLeft;

  return (
    <main className="page-content sale-detail-page">
      <Link href={`/${locale}/sales`} className="sale-back no-print"><Back size={16} aria-hidden="true" />{t('backToSales')}</Link>
      <header className="sale-detail-heading no-print">
        <p>{t('detailKicker')}</p>
        <h1>{t('saleTitle', {number: detail.sale.id})}</h1>
        <span>
          <span className={`sale-status ${completed ? 'is-completed' : 'is-cancelled'}`}>{completed ? t('completed') : t('cancelled')}</span>
          <bdi>{format.format(detail.sale.createdAt)}</bdi>
        </span>
      </header>
      <div className="sale-detail-grid">
        <Receipt
          pharmacyName={pharmacyName}
          sale={detail.sale}
          operatorName={detail.operatorName}
          items={detail.items}
        />
        <aside className="sale-meta no-print">
          <h2>{t('information')}</h2>
          <dl>
            <div><dt>{t('employee')}</dt><dd><bdi>{detail.operatorName}</bdi></dd></div>
            <div><dt>{t('createdAt')}</dt><dd>{format.format(detail.sale.createdAt)}</dd></div>
            <div><dt>{t('createdBy')}</dt><dd><bdi>{detail.createdByName ?? '—'}</bdi></dd></div>
            <div><dt>{t('updatedBy')}</dt><dd><bdi>{detail.updatedByName ?? '—'}</bdi></dd></div>
            <div>
              <dt>{t('shift')}</dt>
              <dd>
                {detail.shift ? (
                  <Link href={`/${locale}/shifts/${detail.shift.id}`}>{format.format(detail.shift.openedAt)}</Link>
                ) : '—'}
              </dd>
            </div>
            <div>
              <dt>{t('status')}</dt>
              <dd><span className={`sale-status ${completed ? 'is-completed' : 'is-cancelled'}`}>{completed ? t('completed') : t('cancelled')}</span></dd>
            </div>
          </dl>
          <h2>{t('auditTimeline')}</h2>
          <ol className="audit-timeline">
            {detail.audit.map((entry) => (
              <li key={entry.id} data-action={entry.action}>
                <strong>{t(`auditActions.${entry.action}`)}</strong>
                <span><bdi>{entry.actorName}</bdi> · <bdi>{format.format(entry.createdAt)}</bdi></span>
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
        isCompleted={completed}
      />
    </main>
  );
}
