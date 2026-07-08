// The literal "ADMIN" user account is a system/management login, not a real
// player — it must never appear in player pickers, leaderboards, or stats.
export const RESERVED_ADMIN_NAME = 'ADMIN'

export function isReservedAdminName(name: string | null | undefined): boolean {
  return (name ?? '').trim().toLowerCase() === RESERVED_ADMIN_NAME.toLowerCase()
}
