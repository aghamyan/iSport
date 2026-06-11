'use client'

import { useRef, useState, useTransition } from 'react'
import { ConfirmDialog } from '@/app/components/ConfirmDialog'
import { useTranslation } from '@/lib/i18n/context'
import {
  createPlayerAction,
  updatePlayerNameAction,
  updateAccessCodeAction,
  setPlayerActiveAction,
  setPlayerAdminAction,
  rotateAccessCodeAction,
  deletePlayerAction,
} from './actions'
import { uploadAvatarAction } from '@/lib/auth/avatarAction'

type Player = {
  id: string
  name: string
  isActive: boolean
  isAdmin: boolean
  createdAt: string
  avatarUrl: string | null
}

type Props = { players: Player[] }

const S = {
  badge: (color: string, bg: string): React.CSSProperties => ({
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    background: bg,
    color,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  }),
  btn: (color: string, bg: string): React.CSSProperties => ({
    padding: '5px 12px',
    background: bg,
    color,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  }),
  input: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
}

function AccessCodeCell({ playerId }: { playerId: string }) {
  const { t } = useTranslation()
  const [shownCode, setShownCode] = useState<string | null>(null)
  const [editing, setEditing]     = useState(false)
  const [value, setValue]         = useState('')
  const [error, setError]         = useState('')
  const [pending, start]          = useTransition()
  const [confirmRotate, setConfirmRotate] = useState(false)

  function handleRotate() {
    start(async () => {
      const result = await rotateAccessCodeAction(playerId)
      setShownCode(result.newCode)
      setConfirmRotate(false)
    })
  }

  function handleSaveEdit() {
    if (!value.trim()) return
    start(async () => {
      try {
        const result = await updateAccessCodeAction(playerId, value)
        setShownCode(result.newCode)
        setEditing(false)
        setError('')
        setValue('')
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
            style={{ ...S.input, width: 130, fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}
            placeholder="e.g. WOLF-2024"
            autoFocus
            spellCheck={false}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') { setEditing(false); setError('') } }}
          />
          <button onClick={handleSaveEdit} disabled={pending} style={S.btn('#fff', '#2563eb')}>{t('common.save')}</button>
          <button onClick={() => { setEditing(false); setError('') }} style={S.btn('#374151', '#f3f4f6')}>{t('common.cancel')}</button>
        </div>
        {error && <span style={{ fontSize: 11, color: '#dc2626' }}>{error}</span>}
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {shownCode ? (
          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '3px 8px', borderRadius: 6 }}>
            {shownCode}
          </span>
        ) : (
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#9ca3af' }}>••••-••••</span>
        )}
        <button onClick={() => { setEditing(true); setValue('') }} disabled={pending} style={S.btn('#374151', '#f3f4f6')}>
          {t('common.edit')}
        </button>
        <button onClick={() => setConfirmRotate(true)} disabled={pending} style={S.btn('#fff', '#dc2626')}>
          {t('common.rotate')}
        </button>
      </div>
      {confirmRotate && (
        <ConfirmDialog
          title={t('admin.players.rotateTitle')}
          message={t('admin.players.rotateMsg')}
          confirmLabel={t('common.rotate')}
          danger
          onConfirm={handleRotate}
          onCancel={() => setConfirmRotate(false)}
        />
      )}
    </>
  )
}

function EditNameInline({ player }: { player: Player }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(player.name)
  const [error, setError]     = useState('')
  const [pending, start]      = useTransition()

  function save() {
    if (!value.trim()) return
    start(async () => {
      try {
        await updatePlayerNameAction(player.id, value)
        setEditing(false)
        setError('')
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  if (!editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 600, color: '#111827' }}>{player.name}</span>
        <button onClick={() => setEditing(true)} style={S.btn('#374151', '#f3f4f6')}>{t('common.edit')}</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ ...S.input, width: 160 }}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        autoFocus
      />
      <button onClick={save} disabled={pending} style={S.btn('#fff', '#2563eb')}>{t('common.save')}</button>
      <button onClick={() => setEditing(false)} style={S.btn('#374151', '#f3f4f6')}>{t('common.cancel')}</button>
      {error && <span style={{ fontSize: 12, color: '#dc2626' }}>{error}</span>}
    </div>
  )
}

function AvatarCell({ player }: { player: Player }) {
  const [url, setUrl]       = useState(player.avatarUrl)
  const [error, setError]   = useState('')
  const [pending, start]    = useTransition()
  const inputRef            = useRef<HTMLInputElement>(null)
  const [hovered, setHover] = useState(false)

  const initials = player.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    const fd = new FormData()
    fd.append('avatar', file)
    fd.append('targetUserId', player.id)
    start(async () => {
      const res = await uploadAvatarAction(fd)
      if (res.error) setError(res.error)
      else if (res.url) setUrl(res.url)
    })
    e.target.value = ''
  }

  const SIZE = 36

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <div
        onClick={() => inputRef.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="Change avatar"
        style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0, cursor: 'pointer' }}
      >
        {url ? (
          <img
            src={url}
            alt={player.name}
            width={SIZE}
            height={SIZE}
            style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb', display: 'block' }}
          />
        ) : (
          <div style={{
            width: SIZE, height: SIZE, borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: SIZE * 0.3, fontWeight: 800, color: '#fff',
            border: '2px solid #e5e7eb',
          }}>
            {initials}
          </div>
        )}
        {(hovered || pending) && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 14, lineHeight: 1 }}>{pending ? '⏳' : '📷'}</span>
          </div>
        )}
      </div>
      <div>
        {error && <div style={{ fontSize: 10, color: '#dc2626', maxWidth: 140 }}>{error}</div>}
      </div>
    </div>
  )
}

function PlayerRow({ player }: { player: Player }) {
  const { t } = useTranslation()
  const [pending, start] = useTransition()
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [confirmDelete, setConfirmDelete]         = useState(false)
  const [deleteError, setDeleteError]             = useState('')

  function toggleActive() {
    if (player.isActive) {
      setConfirmDeactivate(true)
    } else {
      start(async () => { await setPlayerActiveAction(player.id, true) })
    }
  }

  function doDeactivate() {
    start(async () => {
      await setPlayerActiveAction(player.id, false)
      setConfirmDeactivate(false)
    })
  }

  function toggleAdmin() {
    start(async () => { await setPlayerAdminAction(player.id, !player.isAdmin) })
  }

  function doDelete() {
    start(async () => {
      try {
        await deletePlayerAction(player.id)
        setConfirmDelete(false)
      } catch (e) {
        setDeleteError((e as Error).message)
        setConfirmDelete(false)
      }
    })
  }

  return (
    <>
      <tr style={{ borderBottom: '1px solid #f3f4f6', opacity: pending ? 0.6 : 1 }}>
        <td style={{ padding: '14px 16px', width: 56 }}>
          <AvatarCell player={player} />
        </td>
        <td style={{ padding: '14px 16px' }}>
          <EditNameInline player={player} />
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {new Date(player.createdAt).toLocaleDateString()}
          </div>
        </td>
        <td style={{ padding: '14px 16px' }}>
          <AccessCodeCell playerId={player.id} />
        </td>
        <td style={{ padding: '14px 16px' }}>
          <span style={S.badge(
            player.isActive ? '#16a34a' : '#6b7280',
            player.isActive ? '#dcfce7' : '#f3f4f6',
          )}>
            {player.isActive ? t('common.active') : t('common.inactive')}
          </span>
        </td>
        <td style={{ padding: '14px 16px' }}>
          {player.isAdmin && (
            <span style={S.badge('#9333ea', '#f3e8ff')}>{t('admin.players.adminBadge')}</span>
          )}
        </td>
        <td style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={toggleActive} disabled={pending} style={S.btn('#fff', player.isActive ? '#dc2626' : '#16a34a')}>
              {player.isActive ? t('common.deactivate') : t('common.activate')}
            </button>
            <button onClick={toggleAdmin} disabled={pending} style={S.btn('#374151', '#f3f4f6')}>
              {player.isAdmin ? t('admin.players.revokeAdmin') : t('admin.players.makeAdmin')}
            </button>
            <button onClick={() => { setDeleteError(''); setConfirmDelete(true) }} disabled={pending} style={S.btn('#fff', '#7f1d1d')}>
              {t('common.delete')}
            </button>
          </div>
          {deleteError && <p style={{ fontSize: 11, color: '#dc2626', margin: '6px 0 0' }}>{deleteError}</p>}
        </td>
      </tr>
      {confirmDeactivate && (
        <ConfirmDialog
          title={t('admin.players.deactivateTitle')}
          message={t('admin.players.deactivateMsg', { name: player.name })}
          confirmLabel={t('common.deactivate')}
          danger
          onConfirm={doDeactivate}
          onCancel={() => setConfirmDeactivate(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title={t('admin.players.deleteTitle', { name: player.name })}
          message={t('admin.players.deleteMsg')}
          confirmLabel={t('admin.players.deletePermanently')}
          danger
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

function CreatePlayerModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [pending, start] = useTransition()
  const [created, setCreated] = useState<{ name: string; code: string } | null>(null)
  const [error, setError] = useState('')

  function submit(formData: FormData) {
    start(async () => {
      try {
        const result = await createPlayerAction(formData)
        const name = (formData.get('name') as string)?.trim()
        setCreated({ name, code: result.accessCode })
        setError('')
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  if (created) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700 }}>{t('admin.players.created')}</h2>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: '#4b5563' }}>
            {t('admin.players.createdMsg', { name: created.name })}
          </p>
          <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#059669', background: '#d1fae5', padding: '12px 16px', borderRadius: 8, textAlign: 'center', letterSpacing: '0.1em', marginBottom: 20 }}>
            {created.code}
          </div>
          <button onClick={onClose} style={{ ...S.btn('#fff', '#2563eb'), padding: '10px 20px', fontSize: 14 }}>
            {t('common.done')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t('admin.players.addPlayer')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <form action={submit}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('admin.players.nameLabel')}
          </label>
          <input name="name" required style={{ ...S.input, marginBottom: 16 }} placeholder="Player name" />

          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('admin.players.codeLabel')}
          </label>
          <input
            name="accessCode"
            required
            style={{ ...S.input, fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}
            placeholder="e.g. WOLF-2024"
            spellCheck={false}
            autoComplete="off"
          />
          <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 16px' }}>
            {t('admin.players.codeHint')}
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" name="isAdmin" value="true" />
            {t('admin.players.grantAdmin')}
          </label>

          {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 12px' }}>{error}</p>}

          <button type="submit" disabled={pending} style={{ ...S.btn('#fff', '#2563eb'), padding: '10px 20px', fontSize: 14, width: '100%' }}>
            {pending ? t('admin.players.creating') : t('admin.players.createBtn')}
          </button>
        </form>
      </div>
    </div>
  )
}

export function PlayersClient({ players }: Props) {
  const { t } = useTranslation()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>{t('admin.card.players')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {t(players.length !== 1 ? 'admin.players.count.many' : 'admin.players.count.one', { n: players.length })}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ ...S.btn('#fff', '#2563eb'), padding: '9px 18px', fontSize: 14 }}>
          {t('admin.players.addBtn')}
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {([
                t('admin.players.col.avatar'),
                t('admin.players.col.name'),
                t('admin.players.col.code'),
                t('admin.players.col.status'),
                t('admin.players.col.role'),
                t('admin.players.col.actions'),
              ]).map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((p) => <PlayerRow key={p.id} player={p} />)}
          </tbody>
        </table>
        {players.length === 0 && (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            {t('admin.players.noPlayers')}
          </div>
        )}
      </div>

      {showCreate && <CreatePlayerModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
