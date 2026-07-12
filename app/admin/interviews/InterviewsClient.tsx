'use client'

import { useState, useTransition } from 'react'
import { getInterviewTranscriptAction, type InterviewListRow, type InterviewTranscript } from './actions'

const C = {
  bg:     '#f9fafb',
  card:   '#ffffff',
  border: '#e5e7eb',
  text:   '#111827',
  text2:  '#6b7280',
  muted:  '#9ca3af',
  accent: '#3b82f6',
  gold:   '#f59e0b',
  purple: '#8b5cf6',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function PhaseBadge({ phase }: { phase: 'pre_match' | 'post_match' }) {
  const isPre = phase === 'pre_match'
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: isPre ? '#eff6ff' : '#fdf4ff',
      color: isPre ? C.accent : C.purple,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {isPre ? 'Pre-match' : 'Post-match'}
    </span>
  )
}

function StatusBadge({ status }: { status: 'in_progress' | 'completed' }) {
  const done = status === 'completed'
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: done ? '#ecfdf5' : '#fffbeb',
      color: done ? '#10b981' : C.gold,
    }}>
      {done ? 'Completed' : 'In progress'}
    </span>
  )
}

export function InterviewsClient({ interviews }: { interviews: InterviewListRow[] }) {
  const [selected, setSelected] = useState<InterviewTranscript | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function openTranscript(id: string) {
    setSelectedId(id)
    setError(null)
    startTransition(async () => {
      try {
        const data = await getInterviewTranscriptAction(id)
        setSelected(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load transcript')
      }
    })
  }

  if (interviews.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.muted, background: C.card, borderRadius: 12, border: `1px solid ${C.border}` }}>
        No interviews recorded yet.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 480px', minWidth: 320, background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.bg, textAlign: 'left' }}>
              <th style={{ padding: '10px 14px', fontSize: 11, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Player</th>
              <th style={{ padding: '10px 14px', fontSize: 11, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Opponent</th>
              <th style={{ padding: '10px 14px', fontSize: 11, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Phase</th>
              <th style={{ padding: '10px 14px', fontSize: 11, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
              <th style={{ padding: '10px 14px', fontSize: 11, color: C.text2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Started</th>
            </tr>
          </thead>
          <tbody>
            {interviews.map((iv) => (
              <tr
                key={iv.id}
                onClick={() => openTranscript(iv.id)}
                style={{
                  cursor: 'pointer',
                  borderTop: `1px solid ${C.border}`,
                  background: selectedId === iv.id ? '#eff6ff' : 'transparent',
                }}
              >
                <td style={{ padding: '10px 14px', fontWeight: 700, color: C.text }}>{iv.playerName}</td>
                <td style={{ padding: '10px 14px', color: C.text2 }}>{iv.opponentName}</td>
                <td style={{ padding: '10px 14px' }}><PhaseBadge phase={iv.phase} /></td>
                <td style={{ padding: '10px 14px' }}><StatusBadge status={iv.status} /></td>
                <td style={{ padding: '10px 14px', color: C.muted, whiteSpace: 'nowrap' }}>{fmtDate(iv.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ flex: '1 1 380px', minWidth: 300, background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, minHeight: 200 }}>
        {!selectedId && (
          <div style={{ color: C.muted, fontSize: 13 }}>Select an interview to view the full transcript.</div>
        )}
        {selectedId && isPending && !selected && (
          <div style={{ color: C.muted, fontSize: 13 }}>Loading…</div>
        )}
        {error && (
          <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>
        )}
        {selected && selectedId === selected.id && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
                {selected.playerName} <span style={{ color: C.muted, fontWeight: 500 }}>vs</span> {selected.opponentName}
              </div>
              <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>{selected.championshipName}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <PhaseBadge phase={selected.phase} />
                <StatusBadge status={selected.status} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflowY: 'auto' }}>
              {selected.messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.role === 'journalist' ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    background: m.role === 'journalist' ? C.bg : '#eff6ff',
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    padding: '8px 12px',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: m.role === 'journalist' ? C.purple : C.accent, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>
                    {m.role === 'journalist' ? 'The Mic' : selected.playerName}
                  </div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.45 }}>{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
