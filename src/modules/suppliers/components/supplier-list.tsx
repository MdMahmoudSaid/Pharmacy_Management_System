'use client';

import {Archive, Search} from 'lucide-react';
import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {useDeferredValue, useState} from 'react';

type SupplierRow = {
  id: number;
  name: string;
  phone: string | null;
  contactPerson: string | null;
  isActive: boolean;
  charges: string;
  payments: string;
  balance: string;
};

const money = (value: string) => `${new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(Number(value))} MRU`;

export function SupplierList({rows, locale}: {rows: SupplierRow[]; locale: 'ar' | 'fr'}) {
  const t = useTranslations('Suppliers');
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const search = useDeferredValue(query.trim().toLocaleLowerCase());
  const visible = rows.filter((row) => row.isActive !== archived && `${row.name} ${row.phone ?? ''} ${row.contactPerson ?? ''}`.toLocaleLowerCase().includes(search));
  return (
    <section className="supplier-list-section">
      <div className="catalog-toolbar">
        <label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search')} aria-label={t('search')} /></label>
        <button className="archived-toggle" type="button" aria-pressed={archived} onClick={() => setArchived((value) => !value)}><Archive size={16} />{t('archived')}</button>
      </div>
      <div className="supplier-rows">
        {visible.length ? <div className="supplier-row supplier-row-head" aria-hidden="true"><span>{t('supplier')}</span><span>{t('charges')}</span><span>{t('payments')}</span><span>{t('balance')}</span></div> : null}
        {visible.map((supplier) => (
          <Link className="supplier-row" href={`/${locale}/suppliers/${supplier.id}`} key={supplier.id}>
            <div className="supplier-identity"><span className="supplier-avatar">{supplier.name.charAt(0)}</span><span><strong>{supplier.name}</strong><small>{supplier.phone || supplier.contactPerson || t('noContact')}</small></span></div>
            <span className="supplier-cell"><small>{t('charges')}</small><b dir="ltr">{money(supplier.charges)}</b></span>
            <span className="supplier-cell"><small>{t('payments')}</small><b dir="ltr">{money(supplier.payments)}</b></span>
            <span className={`supplier-cell ${Number(supplier.balance) > 0 ? 'balance-debt' : Number(supplier.balance) < 0 ? 'balance-advance' : ''}`}><small>{t('balance')}</small><b dir="ltr">{money(supplier.balance)}</b></span>
          </Link>
        ))}
        {!visible.length ? <p className="catalog-empty">{t('empty')}</p> : null}
      </div>
    </section>
  );
}
