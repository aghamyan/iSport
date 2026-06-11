import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getAllPlayerBalances, getBalanceStats } from '@/lib/betting/balance'
import { BalancesClient } from './BalancesClient'

export default async function AdminBalancesPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  const [balances, stats] = await Promise.all([
    getAllPlayerBalances(),
    getBalanceStats(),
  ])

  return <BalancesClient balances={balances} stats={stats} />
}
