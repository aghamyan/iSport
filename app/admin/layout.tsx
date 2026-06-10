import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

const NAV = [
  { href: '/admin',              label: 'Overview'       },
  { href: '/admin/players',      label: 'Players'        },
  { href: '/admin/matches',      label: 'Matches'        },
  { href: '/admin/championships',label: 'Championships'  },
  { href: '/admin/badges',       label: 'Badges'         },
  { href: '/admin/settings',     label: 'Settings'       },
  { href: '/admin/activity',     label: 'Activity Log'   },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Sidebar */}
      <nav
        style={{
          width: 220,
          flexShrink: 0,
          background: '#111827',
          padding: '24px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #1f2937' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Admin Panel
          </div>
          <Link
            href="/"
            style={{ fontSize: 12, color: '#9ca3af', textDecoration: 'none', display: 'block', marginTop: 6 }}
          >
            ← Back to site
          </Link>
        </div>

        <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
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
      <main style={{ flex: 1, background: '#f9fafb', minHeight: '100vh', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
