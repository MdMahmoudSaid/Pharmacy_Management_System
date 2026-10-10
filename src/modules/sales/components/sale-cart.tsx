'use client';

import Decimal from 'decimal.js';
import {Minus, Plus, ShoppingCart, Trash2} from 'lucide-react';
import {useTranslations} from 'next-intl';

import {formatMru, type SaleMedicine} from './medicine-search';

export type CartItem = SaleMedicine & {quantity: number; unitPrice: string; overrideReason: string};

export function SaleCart({items, setItems, canOverride}: {
  items: CartItem[];
  setItems: (items: CartItem[]) => void;
  canOverride: boolean;
}) {
  const t = useTranslations('Sales');
  const update = (id: number, patch: Partial<CartItem>) =>
    setItems(items.map((item) => (item.id === id ? {...item, ...patch} : item)));
  const setQuantity = (item: CartItem, quantity: number) =>
    update(item.id, {quantity: Math.min(item.currentStock, Math.max(1, quantity))});

  return (
    <section className="sale-cart">
      <header>
        <h2>{t('cart')}</h2>
        <span>{t('itemsCount', {count: items.length})}</span>
        {items.length ? (
          <button type="button" className="clear-cart" onClick={() => setItems([])}>{t('clearCart')}</button>
        ) : null}
      </header>
      {items.length === 0 ? (
        <div className="empty-cart">
          <ShoppingCart size={28} aria-hidden="true" />
          <p>{t('empty')}</p>
        </div>
      ) : (
        <ul className="cart-lines">
          {items.map((item) => {
            const lineTotal = new Decimal(item.unitPrice || 0).times(item.quantity).toFixed(2);
            const atMax = item.quantity >= item.currentStock;
            return (
              <li key={item.id}>
                <div className="cart-line-main">
                  <strong>{item.name}</strong>
                  <small dir="ltr">{t('priceTimes', {price: formatMru(item.unitPrice || 0), quantity: item.quantity})}</small>
                  {atMax ? <small className="cart-max">{t('maxReached', {count: item.currentStock})}</small> : null}
                </div>
                <div className="quantity-stepper">
                  <button type="button" onClick={() => setQuantity(item, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="−"><Minus size={16} /></button>
                  <input
                    value={item.quantity}
                    onChange={(event) => setQuantity(item, Number(event.target.value) || 1)}
                    inputMode="numeric"
                    aria-label={t('quantity')}
                  />
                  <button type="button" onClick={() => setQuantity(item, item.quantity + 1)} disabled={atMax} aria-label="+"><Plus size={16} /></button>
                </div>
                <b dir="ltr" className="cart-line-total">{formatMru(lineTotal)} <small>MRU</small></b>
                <button type="button" className="remove-item" onClick={() => setItems(items.filter(({id}) => id !== item.id))} aria-label={t('remove')}>
                  <Trash2 size={17} />
                </button>
                {canOverride ? (
                  <div className="cart-override">
                    <label>
                      <span>{t('unitPrice')}</span>
                      <input className="price-input" value={item.unitPrice} onChange={(event) => update(item.id, {unitPrice: event.target.value})} inputMode="decimal" dir="ltr" />
                    </label>
                    {item.unitPrice !== item.sellingPrice ? (
                      <label>
                        <span>{t('overrideReason')}</span>
                        <input value={item.overrideReason} onChange={(event) => update(item.id, {overrideReason: event.target.value})} required />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
