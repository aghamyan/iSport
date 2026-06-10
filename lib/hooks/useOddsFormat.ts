'use client'

import { useState, useEffect } from 'react'
import type { OddsFormat } from '@/lib/odds'

const FORMATS: OddsFormat[] = ['decimal', 'percent', 'fractional', 'american']
const STORAGE_KEY = 'odds_format'

/**
 * Persists the user's preferred odds display format in localStorage.
 * SSR-safe: reads storage in an effect, not during render.
 */
export function useOddsFormat() {
  const [format, setFormatState] = useState<OddsFormat>('decimal')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as OddsFormat | null
    if (stored && (FORMATS as string[]).includes(stored)) setFormatState(stored)
  }, [])

  function setFormat(f: OddsFormat) {
    setFormatState(f)
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, f)
  }

  function cycleFormat() {
    const next = FORMATS[(FORMATS.indexOf(format) + 1) % FORMATS.length]
    setFormat(next)
  }

  return { format, setFormat, cycleFormat }
}
