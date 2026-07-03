import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getCasinoAdminConfigsAction, getCasinoSessionsAction } from './actions'
import { CasinoAdminClient } from './CasinoAdminClient'

export const dynamic = 'force-dynamic'

export default async function CasinoAdminPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const [configs, sessions] = await Promise.all([
    getCasinoAdminConfigsAction(),
    getCasinoSessionsAction(100),
  ])

  return <CasinoAdminClient configs={configs} sessions={sessions} />
}
