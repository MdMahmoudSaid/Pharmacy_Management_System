'use client';

import {useTranslations} from 'next-intl';
import {useActionState, useState} from 'react';

import {
  cancelSaleAction,
  correctSaleAction,
  type SaleChangeActionState
} from '../actions';

type DetailItem = {
  id: number;
  medicineId: number;
  medicineName: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

export function SaleDetailActions({
  saleId,
  locale,
  initialItems,
  canCorrect,
  canCancel,
  isCompleted
}: {
  saleId: number;
  locale: 'ar' | 'fr';
  initialItems: DetailItem[];
  canCorrect: boolean;
  canCancel: boolean;
  isCompleted: boolean;
}) {
  const t = useTranslations('Sales');
  const [items, setItems] = useState(initialItems);
  const [correctState, correctAction, correcting] = useActionState<
    SaleChangeActionState,
    FormData
  >(correctSaleAction, undefined);
  const [cancelState, cancelAction, cancelling] = useActionState<
    SaleChangeActionState,
    FormData
  >(cancelSaleAction, undefined);
  if (!isCompleted || (!canCorrect && !canCancel)) return null;

  return (
    <section className="sale-admin-actions no-print">
      <h2>{t('sensitiveActions')}</h2>
      {canCorrect ? (
        <details>
          <summary>{t('correct')}</summary>
          <form action={correctAction} data-testid="correct-sale-form">
            <input type="hidden" name="id" value={saleId} />
            <input type="hidden" name="locale" value={locale} />
            <input
              type="hidden"
              name="items"
              value={JSON.stringify(
                items.map(({medicineId, quantity, unitPrice}) => ({
                  medicineId,
                  quantity,
                  unitPrice
                }))
              )}
            />
            {items.map((item) => (
              <div className="correction-row" key={item.id}>
                <strong>{item.medicineName}</strong>
                <label>
                  {t('quantity')}
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      setItems(
                        items.map((current) =>
                          current.id === item.id
                            ? {...current, quantity: Number(event.target.value)}
                            : current
                        )
                      )
                    }
                  />
                </label>
                <label>
                  {t('unitPrice')}
                  <input
                    inputMode="decimal"
                    value={item.unitPrice}
                    onChange={(event) =>
                      setItems(
                        items.map((current) =>
                          current.id === item.id
                            ? {...current, unitPrice: event.target.value}
                            : current
                        )
                      )
                    }
                  />
                </label>
              </div>
            ))}
            <input name="reason" placeholder={t('changeReason')} required />
            {correctState && !correctState.ok ? (
              <p className="form-error">{t(`errors.${correctState.code}`)}</p>
            ) : null}
            {correctState?.ok ? <p className="form-success">{t('corrected')}</p> : null}
            <button className="secondary-action" disabled={correcting}>
              {t('saveCorrection')}
            </button>
          </form>
        </details>
      ) : null}
      {canCancel ? (
        <form action={cancelAction} className="cancel-sale-form">
          <input type="hidden" name="id" value={saleId} />
          <input type="hidden" name="locale" value={locale} />
          <input name="reason" placeholder={t('cancelReason')} required />
          {cancelState && !cancelState.ok ? (
            <p className="form-error">{t(`errors.${cancelState.code}`)}</p>
          ) : null}
          <button className="danger-action" disabled={cancelling}>
            {t('cancelSale')}
          </button>
        </form>
      ) : null}
    </section>
  );
}
