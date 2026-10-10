'use client';
import Decimal from 'decimal.js';
import {Minus, Plus, Trash2} from 'lucide-react';
import {useTranslations} from 'next-intl';
import type {SaleMedicine} from './medicine-search';

export type CartItem = SaleMedicine & {quantity: number; unitPrice: string; overrideReason: string};

export function SaleCart({items, setItems, canOverride}: {items: CartItem[]; setItems: (items: CartItem[]) => void; canOverride: boolean}) {
  const t = useTranslations('Sales');
  const update = (id: number, patch: Partial<CartItem>) => setItems(items.map((item) => item.id === id ? {...item, ...patch} : item));
  return <section className="sale-cart"><h2>{t('cart')}</h2>{items.length === 0 ? <p className="empty-cart">{t('empty')}</p> : items.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{new Decimal(item.unitPrice).times(item.quantity).toFixed(2)}</small></div><div className="quantity-stepper"><button type="button" onClick={() => item.quantity > 1 && update(item.id, {quantity: item.quantity - 1})}><Minus size={16} /></button><input value={item.quantity} onChange={(event) => update(item.id, {quantity: Math.max(1, Number(event.target.value) || 1)})} inputMode="numeric" /><button type="button" onClick={() => update(item.id, {quantity: item.quantity + 1})}><Plus size={16} /></button></div>{canOverride ? <><input className="price-input" value={item.unitPrice} onChange={(event) => update(item.id, {unitPrice: event.target.value})} inputMode="decimal" aria-label={t('unitPrice')} />{item.unitPrice !== item.sellingPrice ? <input value={item.overrideReason} onChange={(event) => update(item.id, {overrideReason: event.target.value})} placeholder={t('overrideReason')} required /> : null}</> : null}<button type="button" className="remove-item" onClick={() => setItems(items.filter(({id}) => id !== item.id))} aria-label={t('remove')}><Trash2 size={17} /></button></article>)}</section>;
}
