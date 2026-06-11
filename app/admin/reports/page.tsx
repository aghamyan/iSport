import { getSettlementReportAction, getBetOverrideAuditAction } from '@/app/betting/odds/actions'
import { ReportsClient } from './ReportsClient'

export const dynamic = 'force-dynamic'

export default async function AdminReportsPage() {
  const [{ summary, players }, overrides] = await Promise.all([
    getSettlementReportAction(),
    getBetOverrideAuditAction(50),
  ])

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: '#111827' }}>
        Reports & Analytics
      </h1>
      <p style={{ margin: '0 0 32px', fontSize: 14, color: '#6b7280' }}>
        Settlement summaries, player rankings, house earnings, and override audit log. Default window: last 30 days.
      </p>
      <ReportsClient summary={summary} players={players} overrides={overrides} />
    </div>
  )
}
