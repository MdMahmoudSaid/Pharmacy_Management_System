import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {searchMedicines} from '@/modules/medicines/service';
import {authorize, can} from '@/modules/permissions/service';
import {MovementList} from '@/modules/stock/components/movement-list';
import {ReceiveStockForm} from '@/modules/stock/components/receive-stock-form';
import {movementQuery, parseMovementFilters} from '@/modules/stock/filters';
import {getMedicineMovements} from '@/modules/stock/service';

const text = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

export default async function StockPage({params, searchParams}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession();
  const canReceive = can(actor, 'stock.receive.own', actor.id);
  const canViewAll = can(actor, 'stock.view.all');
  if (!canReceive && !canViewAll) authorize(actor, 'stock.view.all');
  const query = await searchParams;
  const filters = parseMovementFilters({type: text(query.type), period: text(query.period)});
  const [t, medicines, movements] = await Promise.all([
    getTranslations('Stock'),
    canReceive ? searchMedicines() : [],
    canViewAll ? getMedicineMovements(movementQuery(filters)) : []
  ]);
  return (
    <main className="page-content catalog-page">
      <header className="page-heading">
        <p>{t('stockKicker')}</p>
        <h1>{t('stockTitle')}</h1>
        <span>{t('stockSubtitle')}</span>
      </header>
      {canReceive ? <ReceiveStockForm medicines={medicines} locale={locale} /> : null}
      {canViewAll ? <MovementList rows={movements} filters={filters} locale={locale} /> : null}
    </main>
  );
}
