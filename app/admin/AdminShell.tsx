'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type AdminNavItem = {
  href: string
  label: string
}

type AdminShellProps = {
  children: React.ReactNode
  nav: AdminNavItem[]
  panelLabel: string
  backToSiteLabel: string
}

export function AdminShell({ children, nav, panelLabel, backToSiteLabel }: AdminShellProps) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="admin-shell">
      <header className="admin-mobile-header">
        <div>
          <div className="admin-mobile-eyebrow">{panelLabel}</div>
          <div className="admin-mobile-title">
            {nav.find((item) => item.href === pathname)?.label ?? panelLabel}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11"
          aria-label={menuOpen ? 'Close admin navigation' : 'Open admin navigation'}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X /> : <Menu />}
        </Button>
      </header>

      {menuOpen && (
        <button
          className="admin-nav-scrim"
          type="button"
          aria-label="Close admin navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside id={menuId} className={cn('admin-sidebar', menuOpen && 'admin-sidebar--open')}>
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-label">{panelLabel}</div>
          <Link href="/" className="admin-back-link">
            <Home aria-hidden="true" />
            {backToSiteLabel}
          </Link>
        </div>

        <nav className="admin-sidebar-links" aria-label="Admin navigation">
          {nav.map((item) => {
            const active = item.href === '/admin'
              ? pathname === item.href
              : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('admin-sidebar-link', active && 'admin-sidebar-link--active')}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  )
}
