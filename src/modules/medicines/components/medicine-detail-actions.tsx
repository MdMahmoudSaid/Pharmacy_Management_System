'use client';

import {Archive, Boxes, Pencil, RotateCcw} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState} from 'react';

import {ActionDialog} from '@/components/action-dialog';
import {ConfirmForm} from '@/components/confirm-form';
import {AdjustStockForm} from '@/modules/stock/components/adjust-stock-form';
import {archiveMedicineAction, restoreMedicineAction, updateMedicineAction, type MedicineActionState} from '../actions';

type Medicine = {id: number; name: string; code: string | null; sellingPrice: string; minStock: number; isActive: boolean};

export function MedicineDetailActions({medicine, locale, canEdit, canArchive, canAdjust}: {
  medicine: Medicine;
  locale: 'ar' | 'fr';
  canEdit: boolean;
  canArchive: boolean;
  canAdjust: boolean;
}) {
  const t = useTranslations('Stock');
  const [editState, editAction, saving] = useActionState<MedicineActionState, FormData>(updateMedicineAction, undefined);
  const activeAction = medicine.isActive ? archiveMedicineAction : restoreMedicineAction;
  const [activeState, stateAction, switching] = useActionState<MedicineActionState, FormData>(activeAction, undefined);
  return <div className="detail-actions medicine-detail-actions">
    {canAdjust && medicine.isActive ? <ActionDialog title={t('adjustStock')} trigger={<><Boxes size={17} />{t('adjustStock')}</>} triggerClass="primary-action"><AdjustStockForm medicineId={medicine.id} locale={locale} /></ActionDialog> : null}
    {canEdit && medicine.isActive ? <ActionDialog title={t('edit')} trigger={<><Pencil size={17} />{t('edit')}</>}>
      <form action={editAction} className="entry-form">
        <input type="hidden" name="id" value={medicine.id} /><input type="hidden" name="locale" value={locale} />
        <label><span>{t('name')}</span><input name="name" defaultValue={medicine.name} minLength={2} required /></label>
        <label><span>{t('codeLabel')}</span><input name="code" defaultValue={medicine.code ?? ''} dir="ltr" /></label>
        <label><span>{t('priceMru')}</span><input name="sellingPrice" defaultValue={medicine.sellingPrice} inputMode="decimal" dir="ltr" required /></label>
        <label><span>{t('minStock')}</span><input name="minStock" type="number" min="0" step="1" defaultValue={medicine.minStock} dir="ltr" required /></label>
        <div className="entry-footer"><button className="primary-action" disabled={saving}>{t('save')}</button>{editState && !editState.ok ? <small className="form-error">{t(`errors.${editState.code}`)}</small> : null}{editState?.ok ? <small className="form-success">{t('saved')}</small> : null}</div>
      </form>
    </ActionDialog> : null}
    {canArchive ? <ActionDialog title={t(medicine.isActive ? 'archive' : 'restore')} trigger={<>{medicine.isActive ? <Archive size={17} /> : <RotateCcw size={17} />}{t(medicine.isActive ? 'archive' : 'restore')}</>} triggerClass={medicine.isActive ? 'danger-outline-action' : 'secondary-action'}>
      <ConfirmForm action={stateAction} className="status-form" message={t(medicine.isActive ? 'archiveConfirm' : 'restoreConfirm', {name: medicine.name})}>
        <input type="hidden" name="id" value={medicine.id} /><input type="hidden" name="locale" value={locale} />
        <button className={medicine.isActive ? 'danger-action' : 'secondary-action'} disabled={switching}>{t(medicine.isActive ? 'archive' : 'restore')}</button>
        {activeState && !activeState.ok ? <small className="form-error">{t(`errors.${activeState.code}`)}</small> : null}
      </ConfirmForm>
    </ActionDialog> : null}
  </div>;
}
