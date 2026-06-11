// Betting Rules — shows current enforced values and config status.
// Rules marked "enforced" are actually checked at runtime.
// Rules marked "manual" document expected admin behavior but have no automatic guard.

export const dynamic = 'force-dynamic'

const C = {
  bg:     '#f9fafb',
  card:   '#ffffff',
  border: '#e5e7eb',
  text:   '#111827',
  text2:  '#6b7280',
  muted:  '#9ca3af',
  win:    '#10b981',
  gold:   '#f59e0b',
  loss:   '#ef4444',
  accent: '#3b82f6',
  purple: '#8b5cf6',
}

type RuleRow = {
  name:        string
  value:       string
  enforcement: 'enforced' | 'manual' | 'hardcoded'
  description: string
  where:       string
}

const RULES: RuleRow[] = [
  {
    name:        'Rake (house cut)',
    value:       '10% of net profit',
    enforcement: 'enforced',
    description: 'Applied automatically on every winning payout. Rake = (potential − stake) × 10%.',
    where:       'SQL: settle_bet() + fn_resolve_parlay()',
  },
  {
    name:        'Max parlay legs',
    value:       '10 legs',
    enforcement: 'enforced',
    description: 'Validated client-side and in validation.ts before bet is submitted.',
    where:       'lib/betting/validation.ts → MAX_PARLAY_LEGS',
  },
  {
    name:        'Bet override window',
    value:       '24 hours',
    enforcement: 'enforced',
    description: 'DB function rejects any override attempt on a bet settled more than 24 hours ago.',
    where:       'SQL: admin_override_bet() → p_override_hours default 24',
  },
  {
    name:        'Market default status',
    value:       'LOCKED',
    enforcement: 'enforced',
    description: 'New markets are created in LOCKED state. Admin must manually unlock before players can bet.',
    where:       'lib/odds/markets.ts → generateMatchMarkets()',
  },
  {
    name:        'Market auto-lock on match start',
    value:       'Manual',
    enforcement: 'manual',
    description: 'Admin must lock markets manually as match time approaches. No automatic timer is implemented.',
    where:       'Admin action: /admin/betting → Lock button',
  },
  {
    name:        'Settlement delay',
    value:       'Immediate (manual)',
    enforcement: 'manual',
    description: 'Markets are settled on-demand when admin picks the result. No automatic timer after match end.',
    where:       'Admin action: /admin/betting → Settle button',
  },
  {
    name:        'Minimum bet amount',
    value:       '100 ֏',
    enforcement: 'hardcoded',
    description: 'Validated in bet slip before submission. Rejects bets below 100 AMD.',
    where:       'lib/betting/validation.ts → MIN_BET_AMOUNT',
  },
  {
    name:        'Custom props',
    value:       'Enabled',
    enforcement: 'manual',
    description: 'Admin can create custom props at any time from the Betting page. No global on/off toggle.',
    where:       'Admin action: /admin/betting → Add Custom Prop',
  },
  {
    name:        'Parlay same-match restriction',
    value:       'Warning shown',
    enforcement: 'manual',
    description: 'Multiple selections from the same match are allowed but flagged as correlated risk in validation.',
    where:       'lib/betting/validation.ts → validateParlayCombination()',
  },
  {
    name:        'Player suspension',
    value:       'Via is_active flag',
    enforcement: 'manual',
    description: 'Setting a player to inactive prevents login. Bet-level suspension is not yet enforced at the DB layer.',
    where:       'Admin action: /admin/balances → Suspend',
  },
]

const ENFORCEMENT_COLORS: Record<RuleRow['enforcement'], string> = {
  enforced:   C.win,
  hardcoded:  C.accent,
  manual:     C.gold,
}

const ENFORCEMENT_LABELS: Record<RuleRow['enforcement'], string> = {
  enforced:   'DB enforced',
  hardcoded:  'Code enforced',
  manual:     'Manual / admin',
}

export default function AdminRulesPage() {
  return (
    <div style={{ padding: '32px 40px', maxWidth: 860, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: C.text }}>
        Betting Rules
      </h1>
      <p style={{ margin: '0 0 32px', fontSize: 14, color: C.text2 }}>
        Reference for all active betting rules, where they are enforced, and which are manual admin responsibilities.
      </p>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap',
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px',
      }}>
        {(Object.entries(ENFORCEMENT_LABELS) as [RuleRow['enforcement'], string][]).map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: ENFORCEMENT_COLORS[key],
            }} />
            <span style={{ fontSize: 12, color: C.text2 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Rules table */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '200px 140px 120px 1fr',
          padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
          fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>Rule</span>
          <span>Current value</span>
          <span>Enforcement</span>
          <span>Where</span>
        </div>

        {RULES.map((rule, i) => {
          const color = ENFORCEMENT_COLORS[rule.enforcement]
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '200px 140px 120px 1fr',
              padding: '14px 16px',
              borderBottom: i < RULES.length - 1 ? `1px solid ${C.border}` : 'none',
              alignItems: 'start',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{rule.name}</div>
                <div style={{ fontSize: 12, color: C.text2, marginTop: 4, lineHeight: 1.5 }}>
                  {rule.description}
                </div>
              </div>

              <div style={{ fontWeight: 700, fontSize: 14, color: C.text, paddingTop: 1 }}>
                {rule.value}
              </div>

              <div style={{ paddingTop: 2 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 8,
                  background: `${color}18`, color,
                }}>
                  {ENFORCEMENT_LABELS[rule.enforcement]}
                </span>
              </div>

              <div style={{ fontSize: 12, color: C.muted, fontFamily: 'monospace', paddingTop: 3, wordBreak: 'break-word' }}>
                {rule.where}
              </div>
            </div>
          )
        })}
      </div>

      {/* Note */}
      <div style={{
        marginTop: 24, padding: '14px 18px',
        background: '#fffbeb', border: `1px solid ${C.gold}44`, borderRadius: 12,
        fontSize: 13, color: C.text2, lineHeight: 1.6,
      }}>
        <strong style={{ color: C.text }}>To make manual rules automatic</strong>, the enforcement point (SQL function or
        server action) must be updated to read from a config table. The current architecture intentionally
        keeps settlement manual — admins review results before confirming. Override window and rake % are the
        only values currently configurable per-call.
      </div>
    </div>
  )
}
