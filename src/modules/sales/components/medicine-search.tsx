'use client';
import {Search, Plus} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useDeferredValue, useState} from 'react';

export type SaleMedicine = {id: number; name: string; code: string | null; sellingPrice: string; currentStock: number};

export function MedicineSearch({medicines, onAdd}: {medicines: SaleMedicine[]; onAdd: (medicine: SaleMedicine) => void}) {
  const t = useTranslations('Sales');
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.toLocaleLowerCase());
  const rows = medicines.filter((item) => `${item.name} ${item.code ?? ''}`.toLocaleLowerCase().includes(query));
  return <section className="sale-search"><div className="search-box"><Search size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} /></div><div className="sale-medicine-results">{rows.map((medicine) => <button type="button" key={medicine.id} onClick={() => onAdd(medicine)}><span><strong>{medicine.name}</strong><small>{medicine.currentStock} {t('available')}</small></span><b>{medicine.sellingPrice}</b><Plus size={18} /></button>)}</div></section>;
}
