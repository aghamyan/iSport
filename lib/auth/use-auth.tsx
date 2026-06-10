'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type AuthUser = {
  userId: string
  isAdmin: boolean
} | null

const AuthContext = createContext<AuthUser>(null)

/**
 * Wrap a layout (server component) with this provider after reading the
 * session server-side:
 *
 *   const session = await getSession()
 *   const user = session ? { userId: session.sub, isAdmin: session.isAdmin } : null
 *   return <AuthProvider user={user}>{children}</AuthProvider>
 */
export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser
  children: ReactNode
}) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
}

/** Returns the current user from the nearest AuthProvider, or null for guests. */
export function useAuth(): AuthUser {
  return useContext(AuthContext)
}

/** Throws if called outside an authenticated context — use in write-only components. */
export function useRequiredAuth(): NonNullable<AuthUser> {
  const user = useContext(AuthContext)
  if (!user) throw new Error('useRequiredAuth called outside authenticated context')
  return user
}
