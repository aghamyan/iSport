'use client'

import { useState, useEffect } from 'react'

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export type EditTimerResult = {
  /** Human-readable countdown string, e.g. "3:42:17". Null if no deadline. */
  timeLeft: string | null
  /** True once now() has passed the deadline. Always false if deadline is null. */
  isExpired: boolean
}

/**
 * Tracks the time remaining until `editDeadline` and updates every second.
 * Pass null when no edit window exists (pending / no deadline set yet).
 *
 * "Final" status should be DERIVED from isExpired rather than from a status
 * column, because the DB never auto-transitions confirmed → final.
 */
export function useEditTimer(editDeadline: string | null): EditTimerResult {
  const [result, setResult] = useState<EditTimerResult>(() => {
    if (!editDeadline) return { timeLeft: null, isExpired: false }
    const remaining = new Date(editDeadline).getTime() - Date.now()
    return {
      timeLeft: formatDuration(remaining),
      isExpired: remaining <= 0,
    }
  })

  useEffect(() => {
    if (!editDeadline) {
      setResult({ timeLeft: null, isExpired: false })
      return
    }

    function tick() {
      const remaining = new Date(editDeadline!).getTime() - Date.now()
      setResult({
        timeLeft: formatDuration(remaining),
        isExpired: remaining <= 0,
      })
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [editDeadline])

  return result
}
