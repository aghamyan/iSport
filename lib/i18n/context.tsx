'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { en, ru, type Locale, type Dict, ruPlural } from './translations'

const STORAGE_KEY = 'isport-lang'
const COOKIE_KEY  = 'lang'

const dicts: Record<Locale, Dict> = { en, ru }

function cookieLocale(): Locale | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(/(?:^|;\s*)lang=([^;]+)/)
  return m ? (m[1] as Locale) : null
}

function setLangCookie(locale: Locale) {
  document.cookie = `${COOKIE_KEY}=${locale};path=/;max-age=31536000;SameSite=Lax`
}

type I18nCtx = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nCtx>({
  locale: 'en',
  setLocale: () => {},
  t: (k) => k,
})

export function I18nProvider({
  children,
  initialLocale = 'en',
}: {
  children: ReactNode
  initialLocale?: Locale
}) {
  // Initialise from the server-passed value (from cookie read in layout).
  // This guarantees server HTML and first client render match — no hydration mismatch.
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  // After mount, reconcile with localStorage (in case cookie and storage diverge).
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (stored && stored !== locale && (stored === 'en' || stored === 'ru')) {
      setLocaleState(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem(STORAGE_KEY, l)
    setLangCookie(l)
  }, [])

  const dict = dicts[locale]

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const str = (dict as Record<string, string>)[key] ?? key
      if (!params) return str
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        str,
      )
    },
    [dict],
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}

// ── Pluralization helpers exported for components ──────────────────────────────

/** English plural: 1 → singular, else plural */
export function enPlural(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural
}

/** Russian plural form key for rivalry counts */
export function rivalryCountKey(n: number, locale: Locale): 'one' | 'many' {
  if (locale === 'ru') {
    const form = ruPlural(n, 'one', 'few', 'many')
    return form === 'one' ? 'one' : 'many'
  }
  return n === 1 ? 'one' : 'many'
}

/** Russian plural form for match counts */
export function matchCountKey(n: number, locale: Locale): 'one' | 'many' {
  return rivalryCountKey(n, locale)
}
