'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Home, Ticket, BarChart2, Trophy, Swords, Newspaper,
  ShoppingBag, User, Sun, Moon, LogOut, X,
} from 'lucide-react'
import { logoutAction } from '@/lib/auth/actions'
import { useTranslation } from '@/lib/i18n/context'
import { useTheme } from '@/lib/theme/useTheme'

const NAV_ITEMS = [
  { key: 'home',    href: '/',              Icon: Home,        labelKey: 'nav.home' },
  { key: 'bet',     href: '/betting',       Icon: Ticket,      labelKey: 'nav.bet' },
  { key: 'stats',   href: '/leaderboard',   Icon: BarChart2,   labelKey: 'nav.stats' },
  { key: 'champs',  href: '/championships', Icon: Trophy,      labelKey: 'nav.champs' },
  { key: 'rivals',  href: '/rivalries',     Icon: Swords,      labelKey: 'nav.rivals' },
  { key: 'news',    href: '/news',          Icon: Newspaper,   labelKey: 'nav.news' },
  { key: 'shop',    href: '/shop',          Icon: ShoppingBag, labelKey: 'nav.shop' },
  { key: 'profile', href: null,             Icon: User,        labelKey: 'nav.profile' },
]

export function BottomNav({ userId }: { userId: string }) {
  const pathname = usePathname()
  const { locale, setLocale, t } = useTranslation()
  const [pending, startTransition] = useTransition()
  const { theme, toggleTheme } = useTheme()
  const [logoUrl, setLogoUrl] = useState('/fc-logo.svg')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/settings/logo')
      .then(r => r.json())
      .then(({ url }) => { if (url) setLogoUrl(url) })
      .catch(() => {})
  }, [])

  // Close on navigation
  useEffect(() => { setOpen(false) }, [pathname])

  function isActive(href: string | null) {
    const h = href ?? `/players/${userId}`
    return h === '/' ? pathname === '/' : pathname.startsWith(h)
  }

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="bnav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.48)',
              backdropFilter: 'blur(5px)',
              WebkitBackdropFilter: 'blur(5px)',
              zIndex: 48,
            }}
          />
        )}
      </AnimatePresence>

      {/* Floating menu panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="bnav-menu"
            initial={{ opacity: 0, y: 48, scale: 0.93 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 36, scale: 0.94 }}
            transition={{ type: 'spring', damping: 24, stiffness: 370, mass: 0.85 }}
            style={{
              position: 'fixed',
              bottom: 74,
              left: 0,
              right: 0,
              margin: '0 auto',
              width: 'min(360px, calc(100vw - 16px))',
              background: 'var(--card)',
              borderRadius: 22,
              border: '1px solid var(--border)',
              boxShadow: '0 16px 56px rgba(0,0,0,0.24), 0 4px 16px rgba(0,0,0,0.1)',
              padding: '18px 14px 14px',
              zIndex: 49,
            }}
          >
            {/* 4×2 nav grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
              marginBottom: 12,
            }}>
              {NAV_ITEMS.map(({ key, href, Icon, labelKey }) => {
                const h = href ?? `/players/${userId}`
                const active = isActive(href)
                return (
                  <Link
                    key={key}
                    href={h}
                    aria-label={key}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '10px 3px',
                      borderRadius: 13,
                      background: active
                        ? 'rgba(var(--rgb-accent),0.11)'
                        : 'var(--bg)',
                      border: `1px solid ${active ? 'rgba(var(--rgb-accent),0.28)' : 'var(--border)'}`,
                      color: active ? 'var(--accent)' : 'var(--muted)',
                      textDecoration: 'none',
                      transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                      minWidth: 0,
                      overflow: 'hidden',
                    }}
                    className="bnav-menu-item"
                  >
                    <Icon size={18} strokeWidth={active ? 2.1 : 1.75} />
                    <span style={{
                      fontSize: 8,
                      fontWeight: active ? 700 : 500,
                      letterSpacing: 0,
                      textAlign: 'center',
                      lineHeight: 1.25,
                      width: '100%',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                    }}>
                      {t(labelKey)}
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* Language + Sign out row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 11,
              borderTop: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {(['en', 'ru'] as const).map((loc) => (
                  <button
                    key={loc}
                    onClick={() => setLocale(loc)}
                    style={{
                      padding: '10px 14px',
                      minHeight: 44,
                      borderRadius: 8,
                      border: `1px solid ${loc === locale ? 'var(--accent)' : 'var(--border)'}`,
                      cursor: loc === locale ? 'default' : 'pointer',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      background: loc === locale ? 'var(--accent)' : 'transparent',
                      color: loc === locale ? '#fff' : 'var(--muted)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {loc.toUpperCase()}
                  </button>
                ))}
                <button
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.12s',
                  }}
                >
                  {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
                </button>
              </div>
              <button
                onClick={() => startTransition(() => logoutAction())}
                disabled={pending}
                aria-label="Sign out"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '10px 14px',
                  minHeight: 44,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: pending ? 'var(--border)' : 'var(--muted)',
                  cursor: pending ? 'default' : 'pointer',
                  fontSize: 10,
                  fontWeight: 600,
                  opacity: pending ? 0.5 : 1,
                }}
              >
                <LogOut size={12} strokeWidth={1.75} />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar — logo toggle button */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 58,
          background: 'var(--nav-bg)',
          borderTop: '1px solid var(--nav-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          boxShadow: '0 -1px 8px rgba(0,0,0,0.06)',
          overflow: 'visible',
        }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          style={{
            position: 'relative',
            width: 62,
            height: 62,
            borderRadius: '50%',
            background: open ? 'var(--accent)' : 'var(--nav-bg)',
            border: '2.5px solid var(--accent)',
            boxShadow: open
              ? '0 6px 22px rgba(220,38,38,0.55)'
              : '0 4px 18px rgba(220,38,38,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transform: 'translateY(-16px)',
            cursor: 'pointer',
            overflow: 'hidden',
            padding: 6,
            zIndex: 51,
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >
          {/* Logo — visible when menu is closed */}
          <span
            style={{
              position: 'absolute',
              opacity: open ? 0 : 1,
              transform: open ? 'scale(0.5) rotate(90deg)' : 'scale(1) rotate(0deg)',
              transition: 'opacity 0.15s, transform 0.15s',
              fontFamily: 'var(--font-heading, sans-serif)',
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: '0.04em',
              color: 'var(--accent)',
              lineHeight: 1,
              userSelect: 'none',
            }}
          >
            FC26
          </span>
          {/* X icon — visible when menu is open */}
          <X
            size={24}
            color={open ? '#fff' : 'transparent'}
            strokeWidth={2.5}
            style={{
              position: 'absolute',
              opacity: open ? 1 : 0,
              transform: open ? 'scale(1) rotate(0deg)' : 'scale(0.5) rotate(-90deg)',
              transition: 'opacity 0.15s, transform 0.15s',
            }}
          />
        </button>
      </nav>
    </>
  )
}
