'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { BetSlip } from '@/app/betting/BetSlip'
import { BottomNav } from '@/app/components/BottomNav'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'
import { useAuth } from '@/lib/auth/use-auth'

export function AppChrome() {
  const user = useAuth()
  const pathname = usePathname()
  const isAdminArea = pathname.startsWith('/admin')
  const showPlayerNavigation = Boolean(user && !isAdminArea)

  useEffect(() => {
    document.body.classList.toggle('has-player-navigation', showPlayerNavigation)
  }, [showPlayerNavigation])

  if (!user) return <LanguageSwitcher />
  if (isAdminArea) return null

  return (
    <>
      <BottomNav userId={user.userId} />
      {!user.isAdmin && <BetSlip userId={user.userId} />}
    </>
  )
}
