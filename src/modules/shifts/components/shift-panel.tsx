'use client';

import {Clock3, LogIn, LogOut} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState} from 'react';

import {ConfirmForm} from '@/components/confirm-form';

import {
  closeShiftAction,
  openShiftAction,
  type ShiftActionState
} from '../actions';

export function ShiftPanel({
  locale,
  activeShift
}: {
  locale: 'ar' | 'fr';
  activeShift?: {id: number; openedAt: Date};
}) {
  const t = useTranslations('Shifts');
  const action = activeShift ? closeShiftAction : openShiftAction;
  const [state, formAction, pending] = useActionState<ShiftActionState, FormData>(
    action,
    undefined
  );
  return (
    <section className="shift-panel">
      <div className="shift-panel-icon"><Clock3 /></div>
      <div>
        <p>{activeShift ? t('active') : t('noActive')}</p>
        <h2>
          {activeShift
            ? new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: 'Africa/Nouakchott'
              }).format(activeShift.openedAt)
            : t('ready')}
        </h2>
      </div>
      <ConfirmForm
        action={formAction}
        enabled={Boolean(activeShift)}
        message={t('closeConfirm')}
      >
        <input type="hidden" name="locale" value={locale} />
        {activeShift ? <input type="hidden" name="id" value={activeShift.id} /> : null}
        {state && !state.ok ? <p className="form-error">{t(`errors.${state.code}`)}</p> : null}
        <button className="primary-action" disabled={pending}>
          {activeShift ? <LogOut size={18} /> : <LogIn size={18} />}
          {activeShift ? t('close') : t('open')}
        </button>
      </ConfirmForm>
    </section>
  );
}
