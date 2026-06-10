import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'

const CARDS = [
  { href: '/admin/players',       label: 'Players',        desc: 'Manage access codes and player status' },
  { href: '/admin/matches',       label: 'Matches',        desc: 'View, edit, and delete friendly matches' },
  { href: '/admin/championships', label: 'Championships',  desc: 'Create, delete, and manage championships' },
  { href: '/admin/badges',        label: 'Badges',         desc: 'Award or revoke player badges' },
  { href: '/admin/settings',      label: 'Settings',       desc: 'Gameplay rules and display preferences' },
  { href: '/admin/activity',      label: 'Activity Log',   desc: 'Audit trail of all admin actions' },
]

export default async function AdminOverviewPage() {
  const supabase = createServiceClient()

  const [playersRes, matchesRes, champsRes] = await Promise.all([
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('friendly_matches').select('id', { count: 'exact', head: true }),
    supabase.from('championships').select('id', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: 'Players',       value: playersRes.count ?? 0 },
    { label: 'Matches',       value: matchesRes.count ?? 0 },
    { label: 'Championships', value: champsRes.count ?? 0 },
  ]

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: '#111827' }}>
        Admin Dashboard
      </h1>
      <p style={{ margin: '0 0 32px', fontSize: 14, color: '#6b7280' }}>
        Manage all platform data and settings
      </p>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 40 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827' }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Navigation cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: '20px 24px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                cursor: 'pointer',
                height: '100%',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.4 }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
