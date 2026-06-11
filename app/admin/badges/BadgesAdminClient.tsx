'use client'

import { useState, useTransition } from 'react'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'
import { useTranslation } from '@/lib/i18n/context'
import { createBadgeAction, deleteBadgeAction, awardBadgeAction, revokeBadgeAction } from './actions'

type Badge = {
  id: string
  name: string
  description: string | null
  badgeType: string
  iconUrl: string | null
}

type PlayerBadge = {
  id: string
  playerId: string
  playerName: string
  badgeId: string
  badgeName: string
  earnedAt: string
}

type Player = { id: string; name: string }
type Props = { badges: Badge[]; playerBadges: PlayerBadge[]; players: Player[] }

const S = {
  btn: (color: string, bg: string): React.CSSProperties => ({
    padding: '5px 12px', background: bg, color, border: 'none', borderRadius: 6,
    cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const,
  }),
  input: {
    padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: 14, width: '100%', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  label: {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#374151',
    marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  } as React.CSSProperties,
}

function CreateBadgeModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    start(async () => {
      try {
        await createBadgeAction(
          fd.get('name') as string,
          fd.get('description') as string,
          fd.get('badgeType') as string,
          fd.get('iconUrl') as string || undefined
        )
        onClose()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 420, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('admin.badges.createTitle')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <form onSubmit={submit}>
          <label style={S.label}>{t('admin.badges.nameLabel')}</label>
          <input name="name" required style={{ ...S.input, marginBottom: 14 }} placeholder="e.g. Rivalry Champion" />

          <label style={S.label}>{t('admin.badges.typeLabel')}</label>
          <input name="badgeType" required style={{ ...S.input, marginBottom: 14 }} placeholder="e.g. rivalry_won, streak, milestone" />

          <label style={S.label}>{t('admin.badges.descLabel')}</label>
          <input name="description" style={{ ...S.input, marginBottom: 14 }} placeholder="Short description" />

          <label style={S.label}>{t('admin.badges.iconLabel')}</label>
          <input name="iconUrl" style={{ ...S.input, marginBottom: 20 }} placeholder="https://..." />

          {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}
          <button type="submit" disabled={pending} style={{ ...S.btn('#fff', '#2563eb'), padding: '10px 20px', fontSize: 14, width: '100%' }}>
            {pending ? t('admin.badges.creating') : t('admin.badges.createBtn')}
          </button>
        </form>
      </div>
    </div>
  )
}

function AwardBadgeModal({ badges, players, onClose }: { badges: Badge[]; players: Player[]; onClose: () => void }) {
  const { t } = useTranslation()
  const [playerId, setPlayerId] = useState('')
  const [badgeId, setBadgeId]   = useState('')
  const [pending, start]        = useTransition()
  const [error, setError]       = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!playerId || !badgeId) return
    start(async () => {
      try {
        await awardBadgeAction(playerId, badgeId)
        onClose()
      } catch (err) {
        setError((err as Error).message)
      }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('admin.badges.awardTitle')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <form onSubmit={submit}>
          <label style={S.label}>{t('admin.badges.playerLabel')}</label>
          <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} required
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', marginBottom: 14 }}>
            <option value="">{t('admin.badges.selectPlayer')}</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <label style={S.label}>{t('admin.badges.badgeLabel')}</label>
          <select value={badgeId} onChange={(e) => setBadgeId(e.target.value)} required
            style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', marginBottom: 20 }}>
            <option value="">{t('admin.badges.selectBadge')}</option>
            {badges.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}
          <button type="submit" disabled={pending || !playerId || !badgeId}
            style={{ ...S.btn('#fff', '#2563eb'), padding: '10px 20px', fontSize: 14, width: '100%' }}>
            {pending ? t('admin.badges.awarding') : t('admin.badges.awardBadge')}
          </button>
        </form>
      </div>
    </div>
  )
}

export function BadgesAdminClient({ badges, playerBadges, players }: Props) {
  const { t } = useTranslation()
  const [showCreate, setShowCreate] = useState(false)
  const [showAward, setShowAward]   = useState(false)
  const [confirmDel, setConfirmDel] = useState<{ id: string; label: string } | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<{ id: string; label: string } | null>(null)
  const [pending, start]            = useTransition()

  function doDeleteBadge() {
    if (!confirmDel) return
    start(async () => {
      await deleteBadgeAction(confirmDel.id)
      setConfirmDel(null)
    })
  }

  function doRevoke() {
    if (!confirmRevoke) return
    start(async () => {
      await revokeBadgeAction(confirmRevoke.id)
      setConfirmRevoke(null)
    })
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>{t('admin.card.badges')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {t(badges.length !== 1 ? 'admin.badges.count.many' : 'admin.badges.count.one', { n: badges.length, awarded: playerBadges.length })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAward(true)} disabled={badges.length === 0 || players.length === 0}
            style={{ ...S.btn('#fff', '#2563eb'), padding: '9px 18px', fontSize: 14 }}>
            {t('admin.badges.awardBtn')}
          </button>
          <button onClick={() => setShowCreate(true)} style={{ ...S.btn('#374151', '#f3f4f6'), padding: '9px 18px', fontSize: 14 }}>
            {t('admin.badges.newTypeBtn')}
          </button>
        </div>
      </div>

      {/* Badge definitions */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('admin.badges.typesTitle')}</h2>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {[
                t('admin.badges.col.name'),
                t('admin.badges.col.type'),
                t('admin.badges.col.desc'),
                t('admin.badges.col.actions'),
              ].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {badges.map((b) => (
              <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13 }}>
                  {b.iconUrl && <img src={b.iconUrl} alt="" style={{ width: 18, height: 18, marginRight: 6, verticalAlign: 'middle' }} />}
                  {b.name}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280' }}>{b.badgeType}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{b.description ?? '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => setConfirmDel({ id: b.id, label: b.name })} disabled={pending} style={S.btn('#fff', '#dc2626')}>{t('common.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {badges.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>{t('admin.badges.noTypes')}</div>
        )}
      </div>

      {/* Awarded badges */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('admin.badges.awardedTitle')}</h2>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {[
                t('admin.badges.col.player'),
                t('admin.badges.col.badge'),
                t('admin.badges.col.awarded'),
                t('admin.badges.col.actions'),
              ].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {playerBadges.map((pb) => (
              <tr key={pb.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{pb.playerName}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{pb.badgeName}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>{new Date(pb.earnedAt).toLocaleDateString()}</td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => setConfirmRevoke({ id: pb.id, label: `${pb.badgeName} from ${pb.playerName}` })} disabled={pending} style={S.btn('#fff', '#dc2626')}>{t('common.revoke')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {playerBadges.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>{t('admin.badges.noAwarded')}</div>
        )}
      </div>

      {showCreate && <CreateBadgeModal onClose={() => setShowCreate(false)} />}
      {showAward && <AwardBadgeModal badges={badges} players={players} onClose={() => setShowAward(false)} />}
      {confirmDel && (
        <ConfirmDialog
          title={t('admin.badges.deleteTitle', { name: confirmDel.label })}
          message={t('admin.badges.deleteMsg')}
          confirmLabel={t('admin.badges.deleteBadge')}
          danger
          onConfirm={doDeleteBadge}
          onCancel={() => setConfirmDel(null)}
        />
      )}
      {confirmRevoke && (
        <ConfirmDialog
          title={t('admin.badges.revokeTitle')}
          message={t('admin.badges.revokeMsg', { label: confirmRevoke.label })}
          confirmLabel={t('admin.badges.revokeBtn')}
          danger
          onConfirm={doRevoke}
          onCancel={() => setConfirmRevoke(null)}
        />
      )}
    </div>
  )
}
