'use client';

import {Printer} from 'lucide-react';
import {useTranslations} from 'next-intl';

export function Receipt({
  pharmacyName,
  sale,
  operatorName,
  items,
  locale
}: {
  pharmacyName: string;
  sale: {saleNumber: string; total: string; createdAt: Date; status: 'COMPLETED' | 'CANCELLED'};
  operatorName: string;
  items: Array<{id: number; medicineName: string; quantity: number; unitPrice: string; lineTotal: string}>;
  locale: 'ar' | 'fr';
}) {
  const t = useTranslations('Sales');
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nouakchott'
  });
  return (
    <section className="receipt" data-testid="receipt">
      <header>
        <h1>{pharmacyName}</h1>
        <p>{t('receipt')} · <span dir="ltr">{sale.saleNumber}</span></p>
        <small>{format.format(sale.createdAt)} · {operatorName}</small>
      </header>
      <div className="receipt-items">
        {items.map((item) => (
          <div key={item.id}>
            <span>{item.medicineName}</span>
            <span>{item.quantity} × {item.unitPrice}</span>
            <strong>{item.lineTotal}</strong>
          </div>
        ))}
      </div>
      <footer>
        <span>{t('total')}</span>
        <strong>{sale.total} MRU</strong>
      </footer>
      {sale.status === 'CANCELLED' ? <b className="receipt-cancelled">{t('cancelled')}</b> : null}
      <button type="button" className="primary-action print-button no-print" onClick={() => window.print()}>
        <Printer size={18} /> {t('print')}
      </button>
    </section>
  );
}
