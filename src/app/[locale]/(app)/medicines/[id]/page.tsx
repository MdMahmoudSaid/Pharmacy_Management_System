import Decimal from 'decimal.js';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import Link from 'next/link';
import {notFound} from 'next/navigation';

import {routing} from '@/i18n/routing';
import {requireSession} from '@/modules/auth/session';
import {MedicineDetailActions} from '@/modules/medicines/components/medicine-detail-actions';
import {getMedicine} from '@/modules/medicines/queries';
import {authorize, can} from '@/modules/permissions/service';
import {getMedicineMovements} from '@/modules/stock/service';

const money = (value: Decimal.Value) => `${new Decimal(value).toFixed(2)} MRU`;

export default async function MedicineDetailPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  if (!hasLocale(routing.locales, locale) || !/^\d+$/.test(id)) notFound();
  setRequestLocale(locale);
  const actor = await requireSession(); authorize(actor, 'medicines.view.all');
  const [t, medicine, movements] = await Promise.all([getTranslations('Stock'), getMedicine(Number(id)), getMedicineMovements({medicineId: Number(id)})]);
  if (!medicine) notFound();
  const value = new Decimal(medicine.averageCost).times(medicine.currentStock);
  const margin = new Decimal(medicine.sellingPrice).minus(medicine.averageCost);
  const date = new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nouakchott'});
  return <main className="page-content medicine-detail-page">
    <div className="detail-topbar"><Link className="back-link" href={`/${locale}/medicines`}>{t('backToMedicines')}</Link><MedicineDetailActions medicine={medicine} locale={locale} canEdit={can(actor, 'medicines.update.all')} canArchive={can(actor, medicine.isActive ? 'medicines.archive.all' : 'medicines.restore.all')} canAdjust={can(actor, 'stock.adjust.all')} /></div>
    <header className="entity-hero medicine-hero"><div><div><p>{medicine.code || t('medicine')}</p><h1>{medicine.name}</h1><span>{medicine.isActive ? t('activeMedicine') : t('archivedMedicine')}</span></div></div><strong>{t('stockCount', {count: medicine.currentStock})}<small>{t('currentStock')}</small></strong></header>
    <section className="detail-stats medicine-stats"><article><span>{t('sellingPrice')}</span><strong dir="ltr">{money(medicine.sellingPrice)}</strong></article><article><span>{t('averageCost')}</span><strong dir="ltr">{money(medicine.averageCost)}</strong></article><article><span>{t('inventoryValue')}</span><strong dir="ltr">{money(value)}</strong></article><article><span>{t('unitMargin')}</span><strong dir="ltr">{money(margin)}</strong></article></section>
    <section className="ledger-panel"><h2>{t('medicineLedger')}</h2><div className="medicine-ledger">{movements.map(({movement, actorName, supplierName, unitCost, totalCost}) => <article key={movement.id}><span className={movement.quantityChange >= 0 ? 'movement-icon is-in' : 'movement-icon is-out'}>{movement.quantityChange >= 0 ? '+' : '−'}</span><div><strong>{t(`types.${movement.type}`)}</strong><small>{actorName} · {date.format(movement.createdAt)}{movement.reason || movement.note ? ` · ${movement.reason ?? movement.note}` : ''}</small>{supplierName && unitCost ? <small>{t('receiptSource', {supplier: supplierName, cost: money(unitCost), total: money(totalCost ?? 0)})}</small> : null}</div><b dir="ltr">{movement.quantityChange > 0 ? '+' : ''}{movement.quantityChange}<small>{movement.quantityBefore} → {movement.quantityAfter}</small></b></article>)}{!movements.length ? <p className="catalog-empty">{t('noMovements')}</p> : null}</div></section>
  </main>;
}
