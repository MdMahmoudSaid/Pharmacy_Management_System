'use client';
import {useTranslations} from 'next-intl';
import {useActionState} from 'react';
import {updateSettingsAction, type SettingsActionState} from '../actions';

export function SettingsForm({settings, locale}: {settings: {pharmacyName: string; defaultLocale: 'ar' | 'fr'}; locale: 'ar' | 'fr'}) {
  const t = useTranslations('Settings');
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(updateSettingsAction, undefined);
  return <form action={action} className="entity-form settings-form"><input type="hidden" name="locale" value={locale} /><label>{t('pharmacyName')}<input name="pharmacyName" defaultValue={settings.pharmacyName} required /></label><label>{t('defaultLocale')}<select name="defaultLocale" defaultValue={settings.defaultLocale}><option value="ar">العربية</option><option value="fr">Français</option></select></label>{state && !state.ok ? <p className="form-error">{state.code}</p> : null}{state?.ok ? <p className="form-success">{t('saved')}</p> : null}<button className="primary-action" disabled={pending}>{t('save')}</button></form>;
}
