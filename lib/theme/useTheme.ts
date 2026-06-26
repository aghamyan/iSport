'use client'

import { useState, useEffect } from 'react'

export type Theme = 'light' | 'dark'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') ?? 'light') as Theme
    setThemeState(current)
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setThemeState(next)
    document.documentElement.setAttribute('data-theme', next)
    document.cookie = `theme=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  }

  return { theme, toggleTheme }
}
