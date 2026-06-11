import { getAdminAllBetsAction } from './actions'
import { BetsAdminClient } from './BetsAdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminBetsPage() {
  const bets = await getAdminAllBetsAction('ALL', 200)

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: '#111827' }}>
        Bet Management
      </h1>
      <p style={{ margin: '0 0 32px', fontSize: 14, color: '#6b7280' }}>
        View, override, and cancel bets. Overrides are limited to the 24-hour window after settlement.
      </p>
      <BetsAdminClient initialBets={bets} />
    </div>
  )
}
