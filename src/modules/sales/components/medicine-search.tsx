'use client';

import {Plus, Search} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useDeferredValue, useRef, useState} from 'react';

export type SaleMedicine = {
  id: number;
  name: string;
  code: string | null;
  sellingPrice: string;
  currentStock: number;
  minStock: number;
};

const amountFormat = new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
export const formatMru = (value: string | number) => amountFormat.format(Number(value));

export function MedicineSearch({medicines, inCart, onAdd}: {
  medicines: SaleMedicine[];
  inCart: Record<number, number>;
  onAdd: (medicine: SaleMedicine) => void;
}) {
  const t = useTranslations('Sales');
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLocaleLowerCase());
  const rows = medicines.filter((item) => `${item.name} ${item.code ?? ''}`.toLocaleLowerCase().includes(query));
  const canAdd = (medicine: SaleMedicine) => (inCart[medicine.id] ?? 0) < medicine.currentStock;

  const addFirst = () => {
    const first = medicines.find(
      (item) => canAdd(item) && `${item.name} ${item.code ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    );
    if (!first) return;
    onAdd(first);
    setSearch('');
    inputRef.current?.focus();
  };

  return (
    <section className="sale-search">
      <label className="search-box">
        <Search size={19} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={search}
          autoFocus
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addFirst();
            }
          }}
          placeholder={t('search')}
          aria-label={t('search')}
        />
      </label>
      <div className="sale-medicine-results">
        {rows.map((medicine) => {
          const out = medicine.currentStock === 0;
          const low = !out && medicine.currentStock <= medicine.minStock;
          const count = inCart[medicine.id] ?? 0;
          return (
            <button
              type="button"
              key={medicine.id}
              onClick={() => onAdd(medicine)}
              disabled={!canAdd(medicine)}
              className={count ? 'is-in-cart' : undefined}
            >
              <span className="sale-medicine-name">
                <strong>{medicine.name}</strong>
                <small>
                  <span className={`stock-badge ${out ? 'is-out' : low ? 'is-low' : 'is-available'}`}>
                    {out ? t('outOfStock') : t('stockLeft', {count: medicine.currentStock})}
                  </span>
                  {count ? <span className="in-cart-badge">{t('inCart', {count})}</span> : null}
                </small>
              </span>
              <b dir="ltr">{formatMru(medicine.sellingPrice)} <small>MRU</small></b>
              <span className="sale-add-icon" aria-hidden="true"><Plus size={18} /></span>
            </button>
          );
        })}
        {!rows.length ? <p className="sale-search-empty">{t('noResults')}</p> : null}
      </div>
    </section>
  );
}
