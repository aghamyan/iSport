import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getServerT } from '@/lib/i18n/server'
import { AdminShell } from './AdminShell'

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
    { href: '/admin/casino',        label: 'Casino'                      },
  ]

  return (
    <AdminShell
      nav={NAV}
      panelLabel={t('admin.panelLabel')}
      backToSiteLabel={t('admin.backToSite')}
    >
      {children}
    </AdminShell>
  )
}
