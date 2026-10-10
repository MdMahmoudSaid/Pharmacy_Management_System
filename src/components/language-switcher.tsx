import {Languages} from 'lucide-react';

import {changeLocaleAction} from '@/modules/auth/actions';

export function LanguageSwitcher({locale}: {locale: 'ar' | 'fr'}) {
  const otherLocale = locale === 'ar' ? 'fr' : 'ar';
  return (
    <form action={changeLocaleAction}>
      <input type="hidden" name="locale" value={otherLocale} />
      <button className="shell-icon-button" aria-label={otherLocale}>
        <Languages size={20} />
        <span>{otherLocale === 'ar' ? 'العربية' : 'Français'}</span>
      </button>
    </form>
  );
}
