import {getTranslations} from 'next-intl/server';
import Link from 'next/link';

type SaleRow = {
  sale: {
    id: number;
    saleNumber: string;
    total: string;
    status: 'COMPLETED' | 'CANCELLED';
    createdAt: Date;
  };
  operatorName: string;
};

export async function SaleHistory({
  rows,
  locale
}: {
  rows: SaleRow[];
  locale: 'ar' | 'fr';
}) {
  const t = await getTranslations('Sales');
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Nouakchott'
  });
  return (
    <section className="sale-history">
      <h2>{t('history')}</h2>
      {rows.length === 0 ? <p>{t('historyEmpty')}</p> : null}
      {rows.map(({sale, operatorName}) => (
        <Link href={`/${locale}/sales/${sale.id}`} key={sale.id}>
          <span>
            <strong dir="ltr">{sale.saleNumber}</strong>
            <small>{operatorName} · {format.format(sale.createdAt)}</small>
          </span>
          <b>{sale.total} MRU</b>
          <em className={sale.status === 'COMPLETED' ? 'status-active' : 'status-archived'}>
            {sale.status === 'COMPLETED' ? t('completed') : t('cancelled')}
          </em>
        </Link>
      ))}
    </section>
  );
}
