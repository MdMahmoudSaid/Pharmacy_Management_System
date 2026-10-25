'use client';
import {useTranslations} from 'next-intl';
import {useActionState} from 'react';
import type {CompanyProfile} from '@/db/schema/audit';
import {updateSettingsAction, type SettingsActionState} from '../actions';

const SLOTS = [0, 1, 2];

export function SettingsForm({settings, locale}: {
  settings: {pharmacyName: string; defaultLocale: 'ar' | 'fr'; profile: CompanyProfile};
  locale: 'ar' | 'fr';
}) {
  const t = useTranslations('Settings');
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(updateSettingsAction, undefined);
  const {profile} = settings;
  return (
    <form action={action} className="entity-form settings-form">
      <input type="hidden" name="locale" value={locale} />
      <label>{t('pharmacyName')}<input name="pharmacyName" defaultValue={settings.pharmacyName} required /></label>
      <label>{t('defaultLocale')}<select name="defaultLocale" defaultValue={settings.defaultLocale}><option value="ar">العربية</option><option value="fr">Français</option></select></label>

      <fieldset className="settings-group">
        <legend>{t('companyTitle')}</legend>
        <p>{t('companyHint')}</p>
        <label>{t('address')}<input name="address" defaultValue={profile.address ?? ''} /></label>
        <label>{t('email')}<input name="email" type="email" dir="ltr" defaultValue={profile.email ?? ''} /></label>
        <div className="settings-pair">
          <label>{t('taxId')}<input name="taxId" dir="ltr" defaultValue={profile.taxId ?? ''} /></label>
          <label>{t('registration')}<input name="registration" dir="ltr" defaultValue={profile.registration ?? ''} /></label>
        </div>
      </fieldset>

      <fieldset className="settings-group">
        <legend>{t('phonesTitle')}</legend>
        {SLOTS.map((i) => (
          <div key={i} className="settings-phone" dir="ltr">
            <span>+</span>
            <input name={`phoneCode${i}`} inputMode="numeric" maxLength={4} defaultValue={profile.phones?.[i]?.code ?? '222'} aria-label={t('countryCode')} />
            <input name={`phone${i}`} inputMode="tel" defaultValue={profile.phones?.[i]?.number ?? ''} aria-label={t('phone', {n: i + 1})} placeholder={t('phone', {n: i + 1})} />
          </div>
        ))}
      </fieldset>

      {state && !state.ok ? <p className="form-error">{state.code}</p> : null}
      {state?.ok ? <p className="form-success">{t('saved')}</p> : null}
      <button className="primary-action" disabled={pending}>{t('save')}</button>
    </form>
  );
}
