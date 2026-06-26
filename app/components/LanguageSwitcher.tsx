'use client'

import { useTranslation } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/translations'

const LOCALES: Locale[] = ['en', 'ru']

export function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation()

  return (
    <div style={{
      position: 'fixed',
      top: 12,
      right: 14,
      zIndex: 200,
      display: 'flex',
      gap: 2,
      background: 'var(--nav-bg)',
      border: '1px solid var(--nav-border)',
      borderRadius: 7,
      padding: '3px 4px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => setLocale(loc)}
          aria-label={`Switch to ${loc === 'en' ? 'English' : 'Русский'}`}
          style={{
            padding: '3px 9px',
            borderRadius: 5,
            border: 'none',
            cursor: loc === locale ? 'default' : 'pointer',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            background: loc === locale ? 'var(--accent)' : 'transparent',
            color: loc === locale ? '#fff' : 'var(--muted)',
            transition: 'all 0.15s',
          }}
        >
          {loc.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
