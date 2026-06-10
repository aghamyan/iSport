'use client'

import { useState } from 'react'

type LogEntry = {
  id: string
  adminName: string
  action: string
  entityType: string
  entityId: string | null
  details: Record<string, unknown> | null
  createdAt: string
}

type Props = { entries: LogEntry[] }

const ENTITY_COLORS: Record<string, { color: string; bg: string }> = {
  player:       { color: '#2563eb', bg: '#dbeafe' },
  match:        { color: '#d97706', bg: '#fef3c7' },
  championship: { color: '#7c3aed', bg: '#ede9fe' },
  badge:        { color: '#059669', bg: '#d1fae5' },
  settings:     { color: '#374151', bg: '#f3f4f6' },
}

const ACTION_LABELS: Record<string, string> = {
  create_player:          'Created player',
  update_player_name:     'Renamed player',
  activate_player:        'Activated player',
  deactivate_player:      'Deactivated player',
  grant_admin:            'Granted admin role',
  revoke_admin:           'Revoked admin role',
  rotate_access_code:     'Rotated access code',
  edit_match_score:       'Edited match score',
  delete_match:           'Deleted match',
  delete_championship:    'Deleted championship',
  reactivate_championship:'Reactivated championship',
  complete_championship:  'Completed championship',
  edit_championship_match:'Edited championship match',
  delete_championship_match: 'Deleted championship match',
  create_badge:           'Created badge type',
  delete_badge:           'Deleted badge type',
  award_badge:            'Awarded badge',
  revoke_badge:           'Revoked badge',
  update_setting:         'Updated setting',
}

export function ActivityLogClient({ entries }: Props) {
  const [entityFilter, setEntityFilter] = useState('all')

  const visible = entityFilter === 'all'
    ? entries
    : entries.filter((e) => e.entityType === entityFilter)

  const entityTypes = ['all', ...Array.from(new Set(entries.map((e) => e.entityType))).sort()]

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>Activity Log</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {entries.length} action{entries.length !== 1 ? 's' : ''} recorded
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {entityTypes.map((t) => (
            <button
              key={t}
              onClick={() => setEntityFilter(t)}
              style={{
                padding: '6px 14px',
                border: '1px solid',
                borderColor: entityFilter === t ? '#2563eb' : '#d1d5db',
                borderRadius: 8,
                background: entityFilter === t ? '#eff6ff' : '#fff',
                color: entityFilter === t ? '#2563eb' : '#6b7280',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            No activity logged yet.
          </div>
        ) : (
          <div>
            {visible.map((entry, i) => {
              const sc = ENTITY_COLORS[entry.entityType] ?? { color: '#6b7280', bg: '#f3f4f6' }
              return (
                <div
                  key={entry.id}
                  style={{
                    padding: '14px 20px',
                    borderBottom: i < visible.length - 1 ? '1px solid #f3f4f6' : 'none',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                  }}
                >
                  {/* Entity type badge */}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 20,
                      background: sc.bg,
                      color: sc.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {entry.entityType}
                  </span>

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: '#111827' }}>
                      <span style={{ fontWeight: 600 }}>{entry.adminName}</span>
                      {' '}
                      {ACTION_LABELS[entry.action] ?? entry.action}
                      {entry.entityId && (
                        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 6, fontFamily: 'monospace' }}>
                          {entry.entityId.slice(0, 8)}…
                        </span>
                      )}
                    </div>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3, fontFamily: 'monospace', background: '#f9fafb', padding: '3px 8px', borderRadius: 4, display: 'inline-block' }}>
                        {JSON.stringify(entry.details)}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0, textAlign: 'right' }}>
                    <div>{new Date(entry.createdAt).toLocaleDateString()}</div>
                    <div>{new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
