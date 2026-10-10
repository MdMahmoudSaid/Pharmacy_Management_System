import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {DataState} from '@/components/data-state';
import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {searchMedicines} from '@/modules/medicines/service';
import {can} from '@/modules/permissions/service';
import {SaleForm} from '@/modules/sales/components/sale-form';
import {SaleHistory} from '@/modules/sales/components/sale-history';
import {parseSalePeriod, salePeriodRange} from '@/modules/sales/period';
import {listSales} from '@/modules/sales/queries';
import {requireActiveShift} from '@/modules/shifts/service';

export default async function SalesPage({
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
  const period = parseSalePeriod(typeof query.period === 'string' ? query.period : undefined);
  const t = await getTranslations('Sales');
  const canCreate = can(actor, 'sales.create.own', actor.id);
  const canView = can(actor, 'sales.view.own', actor.id);
  let shift = null;
  if (canCreate) {
    try {
      shift = await requireActiveShift(actor.id);
    } catch {
      shift = null;
    }
  }
  const [medicines, rows] = await Promise.all([
    shift ? searchMedicines() : Promise.resolve([]),
    canView ? listSales(actor, salePeriodRange(period)) : Promise.resolve([])
  ]);

  return (
    <main className="page-content sales-page">
      <header className="page-heading">
        <p>{t('kicker')}</p>
        <h1>{t('title')}</h1>
        <span>{t('subtitle')}</span>
      </header>
      {shift ? (
        <SaleForm
          medicines={medicines}
          shiftId={shift.id}
          canOverride={can(actor, 'sales.price_override.all')}
          locale={locale}
        />
      ) : canCreate ? (
        <DataState
          title={t('shiftRequired')}
          description={t('shiftRequiredText')}
        />
      ) : null}
      {canView ? <SaleHistory rows={rows} locale={locale} period={period} /> : null}
    </main>
  );
}
