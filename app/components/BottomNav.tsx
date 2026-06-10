'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

const BORDER = '#1a2840'
const ACCENT = '#3b82f6'
const MUTED  = '#4b5a73'

function NI({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

const NAV_ITEMS: { label: string; href: string | null; icon: ReactNode }[] = [
  { label: 'Home',    href: '/',              icon: <NI><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21V12h6v9"/></NI> },
  { label: 'Stats',   href: '/leaderboard',   icon: <NI><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></NI> },
  { label: 'Champs',  href: '/championships', icon: <NI><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></NI> },
  { label: 'Rivals',  href: '/rivalries',     icon: <NI><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="3" y2="21"/></NI> },
  { label: 'Profile', href: null,             icon: <NI><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></NI> },
]

export function BottomNav({ userId }: { userId: string }) {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(12,20,34,0.96)', backdropFilter: 'blur(16px)',
      borderTop: `1px solid ${BORDER}`,
      display: 'flex', zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV_ITEMS.map((item) => {
        const href = item.href ?? `/players/${userId}`
        const isActive = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href ?? `/players/${userId}`)
        return (
          <Link key={item.label} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '10px 4px 8px', textDecoration: 'none', gap: 2,
            borderTop: `2px solid ${isActive ? ACCENT : 'transparent'}`,
            color: isActive ? ACCENT : MUTED,
          }}>
            {item.icon}
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: isActive ? ACCENT : MUTED,
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
