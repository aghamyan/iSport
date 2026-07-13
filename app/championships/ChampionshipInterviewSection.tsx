'use client'

import { useState } from 'react'
import { Mic } from 'lucide-react'
import { ChampionshipInterviewModal } from './ChampionshipInterviewModal'

// Same "The Mic" journalist accent used throughout the interview UI
// (app/championships/MatchInterviewModal.tsx, ChampionshipInterviewModal.tsx).
const MIC_RGB = '139, 92, 246'
const MIC = `rgb(${MIC_RGB})`

type Props = {
  championshipId: string
  championshipName: string
  playerName: string
  isFinished: boolean
  isParticipant: boolean
}

export function ChampionshipInterviewSection({
  championshipId, championshipName, playerName, isFinished, isParticipant,
}: Props) {
  const [open, setOpen] = useState(false)

  if (!isFinished || !isParticipant) return null

  return (
    <>
      <div style={{ padding: '14px 20px 0' }}>
        <button
          onClick={() => setOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '12px 16px', borderRadius: 12,
            border: `1px solid rgba(${MIC_RGB}, 0.3)`,
            background: `linear-gradient(135deg, rgba(${MIC_RGB}, 0.14), rgba(${MIC_RGB}, 0.05))`,
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: `rgba(${MIC_RGB}, 0.18)`, color: MIC,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mic size={17} strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>
              Give your season-wrap interview
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 1 }}>
              The Mic wants to talk about your campaign
            </div>
          </div>
        </button>
      </div>
      {open && (
        <ChampionshipInterviewModal
          championshipId={championshipId}
          championshipName={championshipName}
          playerName={playerName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
