import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {authorize, can} from '@/modules/permissions/service';
import {searchMedicines} from '@/modules/medicines/service';
import {getMedicineMovements} from '@/modules/stock/service';
import {ReceiveStockForm} from '@/modules/stock/components/receive-stock-form';
import {MovementList} from '@/modules/stock/components/movement-list';

export default async function StockPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;if (!hasLocale(routing.locales, locale)) notFound();setRequestLocale(locale);
  const actor = await requireSession();
  const canReceive = can(actor, 'stock.receive.own', actor.id);
  const canViewAll = can(actor, 'stock.view.all');
  if (!canReceive && !canViewAll) authorize(actor, 'stock.view.all');
  const [t, medicines, movements] = await Promise.all([getTranslations('Stock'), searchMedicines(), canViewAll ? getMedicineMovements() : Promise.resolve([])]);
  return <main className="page-content"><header className="page-heading"><p>{t('stockKicker')}</p><h1>{t('stockTitle')}</h1><span>{t('stockSubtitle')}</span></header><div className="employees-layout">{canReceive ? <ReceiveStockForm medicines={medicines} locale={locale} /> : null}{canViewAll ? <MovementList rows={movements} /> : null}</div></main>;
}
