import React from 'react';
import { useLocale } from '../../context/LocaleContext';
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '@workspace/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <select
      value={locale}
      onChange={e => setLocale(e.target.value as Locale)}
      className="text-xs rounded-md px-2 py-1 outline-none cursor-pointer"
      style={{
        background: 'var(--elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      }}
      aria-label="Language"
    >
      {SUPPORTED_LOCALES.map(code => (
        <option key={code} value={code}>{LOCALE_LABELS[code]}</option>
      ))}
    </select>
  );
}
