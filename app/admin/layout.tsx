import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getServerT } from '@/lib/i18n/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const t = await getServerT()

  const NAV = [
    { href: '/admin',               label: t('admin.card.overview')      },
    { href: '/admin/players',       label: t('admin.card.players')       },
    { href: '/admin/matches',       label: t('admin.card.matches')       },
    { href: '/admin/championships', label: t('admin.card.championships') },
    { href: '/admin/badges',        label: t('admin.card.badges')        },
    { href: '/admin/settings',      label: t('admin.card.settings')      },
    { href: '/admin/activity',      label: t('admin.card.activity')      },
    { href: '/admin/betting',       label: 'Betting Markets'             },
    { href: '/admin/bets',          label: 'Bet Management'              },
    { href: '/admin/balances',      label: 'Balances'                    },
    { href: '/admin/reports',       label: 'Reports'                     },
    { href: '/admin/rules',         label: 'Betting Rules'               },
    { href: '/admin/interviews',    label: 'AI Interviews'               },
    { href: '/admin/news',          label: 'News'                        },
    { href: '/admin/shop',          label: 'Shop'                        },
    { href: '/admin/casino',        label: '🎰 Casino'                   },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', flexWrap: 'wrap' }}>
      {/* Sidebar */}
      <style>{`
        @media (max-width: 640px) {
          .admin-sidebar { width: 100% !important; flex-direction: row !important; flex-wrap: wrap; padding: 12px !important; }
          .admin-sidebar-header { padding: 0 8px 12px !important; }
          .admin-sidebar-links { flex-direction: row !important; flex-wrap: wrap; padding: 0 !important; }
          .admin-sidebar-links a { padding: 6px 10px !important; font-size: 12px !important; }
          .admin-main { width: 100% !important; }
        }
      `}</style>
      <nav
        className="admin-sidebar"
        style={{
          width: 220,
          flexShrink: 0,
          background: '#111827',
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="admin-sidebar-header" style={{ padding: '0 20px 24px', borderBottom: '1px solid #1f2937' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {t('admin.panelLabel')}
          </div>
          <Link
            href="/"
            style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none', display: 'block', marginTop: 6 }}
          >
            {t('admin.backToSite')}
          </Link>
        </div>

        <div className="admin-sidebar-links" style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                color: '#d1d5db',
                textDecoration: 'none',
                display: 'block',
                transition: 'background 0.1s',
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="admin-main" style={{ flex: 1, background: '#f9fafb', minHeight: '100vh', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
