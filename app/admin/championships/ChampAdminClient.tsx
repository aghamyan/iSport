'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'
import { useTranslation } from '@/lib/i18n/context'
import { prestigeTierForPlayerCount, PRESTIGE_WEIGHT, type PrestigeTier } from '@/lib/championships/prestige'
import {
  adminDeleteChampionshipAction,
  adminSetChampionshipActiveAction,
  adminUpdateChampionshipMatchAction,
  adminDeleteChampionshipMatchAction,
  adminUpdateChampionshipYoutubeUrlAction,
  adminUpdateChampionshipNameAction,
  adminUpdateChampionshipPrestigeAction,
} from './actions'

const PRESTIGE_TIERS: { tier: PrestigeTier; labelKey: string }[] = [
  { tier: 'friendly', labelKey: 'champ.create.prestige.friendly' },
  { tier: 'standard', labelKey: 'champ.create.prestige.standard' },
  { tier: 'major',    labelKey: 'champ.create.prestige.major' },
]

type CMatch = {
  id: string
  homePlayer: string
  awayPlayer: string
  homeScore: number | null
  awayScore: number | null
  status: 'pending' | 'confirmed' | 'final'
  cycle: number
  isForfeit: boolean
}

type Championship = {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  youtubeUrl: string | null
  prestigeWeight: number
  playerCount: number
  matches: CMatch[]
}

type Props = { championships: Championship[] }

const S = {
  btn: (color: string, bg: string): React.CSSProperties => ({
    padding: '5px 10px',
    background: bg,
    color,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  }),
}

function EditCMatchModal({
  champId,
  match,
  onClose,
}: {
  champId: string
  match: CMatch
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [homeScore, setHome] = useState(match.homeScore ?? 0)
  const [awayScore, setAway] = useState(match.awayScore ?? 0)
  const [status, setStatus]  = useState<'pending' | 'confirmed' | 'final'>(match.status)
  const [isForfeit, setIsForfeit] = useState(match.isForfeit)
  const [error, setError]    = useState('')
  const [pending, start]     = useTransition()

  function save() {
    start(async () => {
      try {
        await adminUpdateChampionshipMatchAction(champId, match.id, homeScore, awayScore, status, isForfeit)
        onClose()
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('admin.matches.editTitle')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          {t('admin.champ.editCycle', { n: match.cycle, home: match.homePlayer, away: match.awayPlayer })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {[['HOME', homeScore, setHome], ['AWAY', awayScore, setAway]].map(([label, val, setter], i) => (
            <div key={String(label)}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{label as string}</div>
              <input
                type="number" min={0} max={99}
                value={val as number}
                onChange={(e) => (setter as (v: number) => void)(Number(e.target.value))}
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 52, textAlign: 'center' }}
              />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%' }}>
            <option value="pending">{t('admin.status.pending')}</option>
            <option value="confirmed">{t('admin.status.confirmed')}</option>
            <option value="final">{t('admin.status.final')}</option>
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isForfeit}
            onChange={(e) => setIsForfeit(e.target.checked)}
            disabled={pending}
          />
          {t('champ.score.forfeitLabel')}
        </label>
        {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.btn('#374151', '#f3f4f6')}>{t('common.cancel')}</button>
          <button onClick={save} disabled={pending} style={S.btn('#fff', '#2563eb')}>
            {pending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChampionshipRow({ champ }: { champ: Championship }) {
  const { t } = useTranslation()
  const [expanded, setExpanded]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editMatch, setEditMatch]   = useState<CMatch | null>(null)
  const [confirmMatchDel, setConfirmMatchDel] = useState<CMatch | null>(null)
  const [pending, start]            = useTransition()
  const [editingYoutube, setEditingYoutube] = useState(false)
  const [youtubeInput, setYoutubeInput] = useState(champ.youtubeUrl ?? '')
  const [youtubeError, setYoutubeError] = useState('')
  const [savingYoutube, startYoutube] = useTransition()
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(champ.name)
  const [nameError, setNameError] = useState('')
  const [savingName, startName] = useTransition()
  const [prestigeError, setPrestigeError] = useState('')
  const [savingPrestige, startPrestige] = useTransition()

  function doDeleteChamp() {
    start(async () => {
      await adminDeleteChampionshipAction(champ.id)
      setConfirmDelete(false)
    })
  }

  function doDeleteMatch() {
    if (!confirmMatchDel) return
    start(async () => {
      await adminDeleteChampionshipMatchAction(champ.id, confirmMatchDel.id)
      setConfirmMatchDel(null)
    })
  }

  function toggleActive() {
    start(async () => { await adminSetChampionshipActiveAction(champ.id, !champ.isActive) })
  }

  function saveName() {
    setNameError('')
    const trimmed = nameInput.trim()
    if (!trimmed) {
      setNameError(t('admin.champ.nameRequired'))
      return
    }
    startName(async () => {
      try {
        await adminUpdateChampionshipNameAction(champ.id, trimmed)
        setEditingName(false)
      } catch (e) {
        setNameError((e as Error).message)
      }
    })
  }

  function setPrestige(weight: number) {
    if (weight === champ.prestigeWeight) return
    setPrestigeError('')
    startPrestige(async () => {
      try {
        await adminUpdateChampionshipPrestigeAction(champ.id, weight)
      } catch (e) {
        setPrestigeError((e as Error).message)
      }
    })
  }

  function saveYoutubeUrl() {
    setYoutubeError('')
    const url = youtubeInput.trim() || null
    startYoutube(async () => {
      try {
        await adminUpdateChampionshipYoutubeUrlAction(champ.id, url)
        setEditingYoutube(false)
      } catch (e) {
        setYoutubeError((e as Error).message)
      }
    })
  }

  return (
    <>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {editingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  style={{ padding: '5px 10px', border: '1px solid #2563eb', borderRadius: 6, fontSize: 14, fontWeight: 700, color: '#111827', minWidth: 200 }}
                />
                <button onClick={saveName} disabled={savingName} style={{ ...S.btn('#fff', '#2563eb'), opacity: savingName ? 0.6 : 1 }}>
                  {savingName ? t('common.saving') : t('common.save')}
                </button>
                <button
                  onClick={() => { setNameInput(champ.name); setEditingName(false); setNameError('') }}
                  style={S.btn('#374151', '#f3f4f6')}
                >
                  {t('common.cancel')}
                </button>
                {nameError && <span style={{ fontSize: 11, color: '#dc2626' }}>{nameError}</span>}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{champ.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: champ.isActive ? '#dcfce7' : '#f3f4f6', color: champ.isActive ? '#16a34a' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {champ.isActive ? t('champ.active') : t('champ.ended')}
                </span>
                <button
                  onClick={() => { setNameInput(champ.name); setEditingName(true) }}
                  style={S.btn('#374151', '#f3f4f6')}
                >
                  {t('common.edit')}
                </button>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {t('admin.champ.playerCount', { n: champ.playerCount })} · {t('admin.champ.matchCount', { n: champ.matches.length })} · {new Date(champ.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link href={`/championships/${champ.id}`} style={{ ...S.btn('#374151', '#f3f4f6'), textDecoration: 'none', display: 'inline-block' }}>
              {t('admin.champ.view')}
            </Link>
            <button onClick={toggleActive} disabled={pending} style={S.btn('#fff', champ.isActive ? '#d97706' : '#16a34a')}>
              {champ.isActive ? t('admin.champ.markComplete') : t('admin.champ.reactivate')}
            </button>
            <button onClick={() => setExpanded(!expanded)} style={S.btn('#2563eb', '#eff6ff')}>
              {expanded ? t('admin.champ.hideMatches') : t('admin.champ.showMatches')}
            </button>
            <button onClick={() => setConfirmDelete(true)} disabled={pending} style={S.btn('#fff', '#dc2626')}>{t('common.delete')}</button>
          </div>
        </div>

        {/* YouTube / Live stream section */}
        <div style={{ padding: '10px 20px 12px', borderTop: '1px solid #f9fafb', background: '#fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
              Live Stream
            </span>

            {editingYoutube ? (
              <>
                <input
                  type="url"
                  placeholder="https://youtube.com/live/..."
                  value={youtubeInput}
                  onChange={(e) => setYoutubeInput(e.target.value)}
                  style={{ flex: 1, minWidth: 240, padding: '5px 10px', border: '1px solid #FF0000', borderRadius: 6, fontSize: 12, outline: 'none', color: '#111827' }}
                />
                <button
                  onClick={saveYoutubeUrl}
                  disabled={savingYoutube}
                  style={{ ...S.btn('#fff', '#FF0000'), opacity: savingYoutube ? 0.6 : 1 }}
                >
                  {savingYoutube ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setYoutubeInput(champ.youtubeUrl ?? ''); setEditingYoutube(false); setYoutubeError('') }}
                  style={S.btn('#374151', '#f3f4f6')}
                >
                  Cancel
                </button>
                {youtubeError && <span style={{ fontSize: 11, color: '#dc2626' }}>{youtubeError}</span>}
              </>
            ) : (
              <>
                {champ.youtubeUrl ? (
                  <a
                    href={champ.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: '#FF0000', fontWeight: 600, textDecoration: 'none', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {champ.youtubeUrl}
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>No stream URL set</span>
                )}
                <button
                  onClick={() => { setYoutubeInput(champ.youtubeUrl ?? ''); setEditingYoutube(true) }}
                  style={{ ...S.btn('#374151', '#f3f4f6'), marginLeft: 4 }}
                >
                  {champ.youtubeUrl ? 'Edit URL' : 'Set URL'}
                </button>
                {champ.youtubeUrl && (
                  <button
                    onClick={() => { setYoutubeInput(''); startYoutube(async () => { await adminUpdateChampionshipYoutubeUrlAction(champ.id, null) }) }}
                    style={S.btn('#fff', '#dc2626')}
                  >
                    Remove
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* P4P prestige weight */}
        <div style={{ padding: '10px 20px 12px', borderTop: '1px solid #f9fafb', background: '#fafafa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
              {t('admin.champ.prestige')}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {PRESTIGE_TIERS.map(({ tier, labelKey }) => {
                const weight = PRESTIGE_WEIGHT[tier]
                const active = champ.prestigeWeight === weight
                return (
                  <button
                    key={tier}
                    onClick={() => setPrestige(weight)}
                    disabled={savingPrestige}
                    style={S.btn(active ? '#fff' : '#374151', active ? '#7c3aed' : '#f3f4f6')}
                  >
                    {t(labelKey)} · {weight}
                  </button>
                )
              })}
            </div>
            {champ.playerCount > 0 && prestigeTierForPlayerCount(champ.playerCount) !== Object.entries(PRESTIGE_WEIGHT).find(([, w]) => w === champ.prestigeWeight)?.[0] && (
              <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                {t('admin.champ.prestigeSuggested', {
                  tier: t(`champ.create.prestige.${prestigeTierForPlayerCount(champ.playerCount)}`),
                  n: champ.playerCount,
                })}
              </span>
            )}
            {prestigeError && <span style={{ fontSize: 11, color: '#dc2626' }}>{prestigeError}</span>}
          </div>
        </div>

        {expanded && (
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '0 20px 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {[
                    t('admin.champ.col.cycle'),
                    t('admin.champ.col.match'),
                    t('admin.champ.col.score'),
                    t('admin.champ.col.status'),
                    t('admin.champ.col.actions'),
                  ].map((h) => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {champ.matches.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '8px', fontSize: 12, color: '#6b7280' }}>{m.cycle}</td>
                    <td style={{ padding: '8px', fontSize: 13 }}>{m.homePlayer} vs {m.awayPlayer}</td>
                    <td style={{ padding: '8px', fontSize: 13, fontWeight: 600 }}>
                      {m.homeScore !== null ? `${m.homeScore} – ${m.awayScore}` : '—'}
                    </td>
                    <td style={{ padding: '8px', fontSize: 12 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: m.status === 'final' ? '#dcfce7' : m.status === 'confirmed' ? '#dbeafe' : '#fef3c7', color: m.status === 'final' ? '#16a34a' : m.status === 'confirmed' ? '#2563eb' : '#d97706' }}>
                          {m.status}
                        </span>
                        {m.isForfeit && (
                          <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}>
                            FORFEIT
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setEditMatch(m)} style={S.btn('#374151', '#f3f4f6')}>{t('common.edit')}</button>
                        <button onClick={() => setConfirmMatchDel(m)} style={S.btn('#fff', '#dc2626')}>{t('common.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={t('admin.champ.deleteTitle', { name: champ.name })}
          message={t('admin.champ.deleteMsg')}
          confirmLabel={t('admin.champ.deleteBtn')}
          danger
          onConfirm={doDeleteChamp}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {editMatch && (
        <EditCMatchModal champId={champ.id} match={editMatch} onClose={() => setEditMatch(null)} />
      )}
      {confirmMatchDel && (
        <ConfirmDialog
          title={t('admin.champ.matchDeleteTitle')}
          message={t('admin.champ.matchDeleteMsg', { cycle: confirmMatchDel.cycle, home: confirmMatchDel.homePlayer, away: confirmMatchDel.awayPlayer })}
          confirmLabel={t('common.delete')}
          danger
          onConfirm={doDeleteMatch}
          onCancel={() => setConfirmMatchDel(null)}
        />
      )}
    </>
  )
}

export function ChampAdminClient({ championships }: Props) {
  const { t } = useTranslation()
  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>{t('admin.card.championships')}</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          {t(championships.length !== 1 ? 'admin.champ.count.many' : 'admin.champ.count.one', { n: championships.length })} · {t('admin.champ.createHint')}{' '}
          <Link href="/championships" style={{ color: '#2563eb' }}>{t('champ.title')}</Link>
        </p>
      </div>

      {championships.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', fontSize: 14, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
          {t('admin.champ.noChamps')}
        </div>
      ) : (
        championships.map((c) => <ChampionshipRow key={c.id} champ={c} />)
      )}
    </div>
  )
}
