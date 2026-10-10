'use client';

import {Eye, EyeOff, UserPlus} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState, useState} from 'react';

import {
  createEmployeeAction,
  type EmployeeActionState
} from '../actions';

export function EmployeeForm({locale}: {locale: 'ar' | 'fr'}) {
  const t = useTranslations('Employees');
  const [showPin, setShowPin] = useState(false);
  const [state, action, pending] = useActionState<EmployeeActionState, FormData>(
    createEmployeeAction,
    undefined
  );

  return (
    <form action={action} className="entity-form" data-testid="create-employee-form">
      <input type="hidden" name="locale" value={locale} />
      <div className="form-section-heading">
        <UserPlus size={20} />
        <strong>{t('newEmployee')}</strong>
      </div>
      <label>
        <span>{t('name')}</span>
        <input name="name" minLength={2} maxLength={120} required />
      </label>
      <label>
        <span>{t('phone')}</span>
        <div className="compact-phone" dir="ltr">
          <b>+222</b>
          <input
            name="phone"
            inputMode="numeric"
            pattern="[234][0-9]{7}"
            minLength={8}
            maxLength={8}
            required
          />
        </div>
      </label>
      <label>
        <span>{t('pin')}</span>
        <div className="compact-pin" dir="ltr">
          <input
            name="pin"
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            pattern="[0-9]{4}"
            minLength={4}
            maxLength={4}
            required
          />
          <button
            type="button"
            onClick={() => setShowPin((value) => !value)}
            aria-label={showPin ? t('hidePin') : t('showPin')}
          >
            {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      {state && !state.ok ? (
        <p className="form-error" role="alert" data-result={state.code}>
          {t(`errors.${state.code}`)}
        </p>
      ) : null}
      {state?.ok ? <p className="form-success">{t('created')}</p> : null}
      <button className="primary-action" disabled={pending}>
        {pending ? t('saving') : t('create')}
      </button>
    </form>
  );
}
