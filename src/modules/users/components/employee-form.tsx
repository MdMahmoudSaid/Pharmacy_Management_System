'use client';

import {ChevronDown, Eye, EyeOff} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useActionState, useState} from 'react';

import {ROLE_PRESETS, type RolePresetKey} from '@/modules/permissions/catalog';
import {
  createEmployeeAction,
  type EmployeeActionState
} from '../actions';

export function EmployeeForm({locale}: {locale: 'ar' | 'fr'}) {
  const t = useTranslations('Employees');
  const [showPin, setShowPin] = useState(false);
  const [preset, setPreset] = useState<RolePresetKey | ''>('shift_employee');
  const [state, action, pending] = useActionState<EmployeeActionState, FormData>(
    createEmployeeAction,
    undefined
  );
  // A new key after each success clears the form; a failed attempt keeps what was typed.
  const [formKey, setFormKey] = useState(0);
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state?.ok) setFormKey((key) => key + 1);
  }

  return (
    <details className="form-collapse">
      <summary><span>{t('newEmployee')}</span><ChevronDown size={20} aria-hidden="true" /></summary>
      <form key={formKey} action={action} className="entry-form" data-testid="create-employee-form">
        <input type="hidden" name="locale" value={locale} />
        <label>
          <span>{t('name')}</span>
          <input name="name" minLength={2} maxLength={120} required />
        </label>
        <label>
          <span>{t('phone')}</span>
          <span className="prefixed-input" dir="ltr">
            <b>+222</b>
            <input
              name="phone"
              inputMode="numeric"
              pattern="[234][0-9]{7}"
              minLength={8}
              maxLength={8}
              placeholder="22 33 44 55"
              required
            />
          </span>
        </label>
        <label>
          <span>{t('pin')}</span>
          <span className="prefixed-input" dir="ltr">
            <input
              name="pin"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]{4}"
              minLength={4}
              maxLength={4}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPin((value) => !value)}
              aria-label={showPin ? t('hidePin') : t('showPin')}
            >
              {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <fieldset className="role-presets">
          <legend>{t('presetTitle')}</legend>
          <label className={preset === 'shift_employee' ? 'is-selected' : ''}>
            <input type="radio" name="preset" value="shift_employee" checked={preset === 'shift_employee'} onChange={() => setPreset('shift_employee')} />
            <span><b>{t('presets.shift_employee.name')}</b><small>{t('presets.shift_employee.hint')}</small></span>
          </label>
          <label className={preset === '' ? 'is-selected' : ''}>
            <input type="radio" name="preset" value="" checked={preset === ''} onChange={() => setPreset('')} />
            <span><b>{t('presets.none.name')}</b><small>{t('presets.none.hint')}</small></span>
          </label>
          {preset ? (
            <ul className="role-preset-list" aria-label={t('presetIncludes')}>
              {ROLE_PRESETS[preset].map((permission) => (
                <li key={permission}>{t(`permissionLabels.${permission.replaceAll('.', '_')}`)}</li>
              ))}
            </ul>
          ) : null}
        </fieldset>
        <div className="entry-footer">
          <button className="primary-action" disabled={pending}>
            {pending ? t('saving') : t('create')}
          </button>
          {state && !state.ok ? (
            <p className="form-error" role="alert" data-result={state.code}>
              {t(`errors.${state.code}`)}
            </p>
          ) : null}
          {state?.ok ? <p className="form-success" role="status">{t('created')}</p> : null}
        </div>
      </form>
    </details>
  );
}
