import { getInterviewsListAction } from './actions'
import { InterviewsClient } from './InterviewsClient'

export const dynamic = 'force-dynamic'

export default async function AdminInterviewsPage() {
  const interviews = await getInterviewsListAction()

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: '#111827' }}>
        AI Match Interviews
      </h1>
      <p style={{ margin: '0 0 32px', fontSize: 14, color: '#6b7280' }}>
        Pre-match and post-match "The Mic" interview transcripts, most recent first.
      </p>
      <InterviewsClient interviews={interviews} />
    </div>
  )
}
