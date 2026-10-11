'use client';

import {Eye, EyeOff, Languages, LockKeyhole, Phone} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useActionState, useState} from 'react';

import {BrandMark} from '@/components/brand-mark';
import {loginAction, type LoginActionState} from '../actions';

const initialState: LoginActionState = {};

export function LoginForm({locale}: {locale: 'ar' | 'fr'}) {
  const t = useTranslations('Auth');
  const brand = useTranslations('Navigation');
  const errors = useTranslations('Errors');
  const [showPin, setShowPin] = useState(false);
  const [state, action, pending] = useActionState(loginAction, initialState);
  const otherLocale = locale === 'ar' ? 'fr' : 'ar';

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <BrandMark className="brand-icon" />
          <strong>{brand('brand')}</strong>
        </div>
        <div className="login-heading">
          <p className="login-kicker">{t('secureAccess')}</p>
          <h1 id="login-title">{t('title')}</h1>
          <p>{t('subtitle')}</p>
        </div>

        <form action={action} className="login-form">
          <input type="hidden" name="locale" value={locale} />
          <label htmlFor="phone">{t('phone')}</label>
          <div className="field-frame phone-field" dir="ltr">
            <Phone size={19} aria-hidden="true" />
            <span className="phone-prefix">+222</span>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              pattern="[234][0-9]{7}"
              minLength={8}
              maxLength={8}
              placeholder="XXXXXXXX"
              required
              aria-describedby="phone-help"
            />
          </div>
          <small id="phone-help">{t('phoneHelp')}</small>

          <label htmlFor="pin">{t('pin')}</label>
          <div className="field-frame" dir="ltr">
            <LockKeyhole size={19} aria-hidden="true" />
            <input
              id="pin"
              name="pin"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="current-password"
              pattern="[0-9]{4}"
              minLength={4}
              maxLength={4}
              placeholder="••••"
              required
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowPin((visible) => !visible)}
              aria-label={showPin ? t('hidePin') : t('showPin')}
            >
              {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {state.error ? (
            <p className="form-error" role="alert">
              {state.error === 'RATE_LIMITED'
                ? errors('rateLimited')
                : errors('authentication')}
            </p>
          ) : null}

          <button className="primary-action login-submit" disabled={pending}>
            {pending ? t('signingIn') : t('login')}
          </button>
        </form>

        <Link className="language-link" href={`/${otherLocale}/login`}>
          <Languages size={18} aria-hidden="true" />
          {t('switchLanguage')}
        </Link>
      </section>
      <aside className="login-aside" aria-hidden="true">
        <div className="login-aside-copy">
          <span className="aside-icon">Rx</span>
          <h2>{t('asideTitle')}</h2>
          <p>{t('asideText')}</p>
        </div>
      </aside>
    </main>
  );
}
