'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  BarChart2,
  Ellipsis,
  Home,
  LogOut,
  Moon,
  Newspaper,
  ShoppingBag,
  Sun,
  Ticket,
  Trophy,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { logoutAction } from '@/lib/auth/actions'
import { useTranslation } from '@/lib/i18n/context'
import { useTheme } from '@/lib/theme/useTheme'

const PRIMARY_NAV_ITEMS = [
  { key: 'home', href: '/', Icon: Home, labelKey: 'nav.home' },
  { key: 'stats', href: '/leaderboard', Icon: BarChart2, labelKey: 'nav.stats' },
  { key: 'champs', href: '/championships', Icon: Trophy, labelKey: 'nav.champs' },
  { key: 'profile', href: null, Icon: User, labelKey: 'nav.profile' },
] as const

const MORE_NAV_ITEMS = [
  { key: 'bet', href: '/betting', Icon: Ticket, labelKey: 'nav.bet' },
  { key: 'news', href: '/news', Icon: Newspaper, labelKey: 'nav.news' },
  { key: 'shop', href: '/shop', Icon: ShoppingBag, labelKey: 'nav.shop' },
] as const

export function BottomNav({ userId }: { userId: string }) {
  const pathname = usePathname()
  const { locale, setLocale, t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const reduceMotion = useReducedMotion()
  const [pending, startTransition] = useTransition()
  const [toolsOpen, setToolsOpen] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setToolsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!toolsOpen) return

    function closeTools(event: PointerEvent) {
      if (shellRef.current && !shellRef.current.contains(event.target as Node)) {
        setToolsOpen(false)
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setToolsOpen(false)
    }

    document.addEventListener('pointerdown', closeTools)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeTools)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [toolsOpen])

  function isActive(href: string | null) {
    const destination = href ?? `/players/${userId}`
    return destination === '/' ? pathname === '/' : pathname.startsWith(destination)
  }

  const moreActive = MORE_NAV_ITEMS.some(({ href }) => isActive(href))

  return (
    <nav className="player-nav" aria-label={t('nav.primary')}>
      <div ref={shellRef} className="player-nav__shell">
        <div className="player-nav__links">
          {PRIMARY_NAV_ITEMS.map(({ key, href, Icon, labelKey }) => {
            const destination = href ?? `/players/${userId}`
            const active = isActive(href)

            return (
              <Link
                key={key}
                href={destination}
                aria-current={active ? 'page' : undefined}
                className={cn('player-nav__item', active && 'player-nav__item--active')}
              >
                <span className="player-nav__icon" aria-hidden="true">
                  <Icon strokeWidth={active ? 2.25 : 1.85} />
                </span>
                <span className="player-nav__label">{t(labelKey)}</span>
              </Link>
            )
          })}
        </div>

        <div className="player-nav__tools">
          <Button
            type="button"
            variant="ghost"
            aria-label={t('nav.more')}
            aria-expanded={toolsOpen}
            aria-controls="player-nav-tools"
            data-active={moreActive || undefined}
            onClick={() => setToolsOpen((value) => !value)}
            className="h-auto min-w-0 flex-col gap-1 px-1 py-2"
          >
            <Ellipsis aria-hidden="true" />
            <span className="player-nav__label">{t('nav.more')}</span>
          </Button>

          <AnimatePresence>
            {toolsOpen && (
              <motion.div
                id="player-nav-tools"
                className="player-nav__tools-panel"
                initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
                role="group"
                aria-label={t('nav.more')}
              >
                <div className="player-nav__tools-header">
                  <div>
                    <p className="player-nav__tools-eyebrow">FC26</p>
                    <p className="player-nav__tools-title">{t('nav.more')}</p>
                  </div>
                  <span className="player-nav__language-status">{locale.toUpperCase()}</span>
                </div>

                <div className="player-nav__more-links" role="group" aria-label={t('nav.more')}>
                  {MORE_NAV_ITEMS.map(({ key, href, Icon, labelKey }) => {
                    const active = isActive(href)

                    return (
                      <Link
                        key={key}
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => setToolsOpen(false)}
                        className={cn(
                          'player-nav__more-item',
                          active && 'player-nav__more-item--active',
                        )}
                      >
                        <Icon strokeWidth={active ? 2.25 : 1.85} aria-hidden="true" />
                        <span>{t(labelKey)}</span>
                      </Link>
                    )
                  })}
                </div>

                <Separator />

                <div className="player-nav__tools-row" aria-label={t('nav.language')}>
                  {(['en', 'ru'] as const).map((language) => (
                    <Button
                      key={language}
                      type="button"
                      size="lg"
                      variant={language === locale ? 'default' : 'outline'}
                      aria-pressed={language === locale}
                      onClick={() => setLocale(language)}
                      className="flex-1"
                    >
                      {t(`lang.${language}`)}
                    </Button>
                  ))}
                </div>

                <Button type="button" size="lg" variant="outline" onClick={toggleTheme}>
                  {theme === 'dark' ? (
                    <Sun data-icon="inline-start" aria-hidden="true" />
                  ) : (
                    <Moon data-icon="inline-start" aria-hidden="true" />
                  )}
                  {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                </Button>

                <Button
                  type="button"
                  size="lg"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => startTransition(() => logoutAction())}
                >
                  <LogOut data-icon="inline-start" aria-hidden="true" />
                  {pending ? t('nav.signingOut') : t('common.signOut')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  )
}
