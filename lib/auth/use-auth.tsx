'use client'

import { usePathname } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

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
  const pathname = usePathname()
  const [currentUser, setCurrentUser] = useState<AuthUser>(user)

  // Root layouts are preserved during App Router navigation. Revalidate the
  // cookie-backed session so login/logout changes update global client chrome.
  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/auth/session', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Session check failed')
        return response.json() as Promise<{ user: AuthUser }>
      })
      .then(({ user: freshUser }) => setCurrentUser(freshUser))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // Keep the server-provided state during a transient network failure.
      })

    return () => controller.abort()
  }, [pathname])

  useEffect(() => {
    setCurrentUser(user)
  }, [user])

  return <AuthContext.Provider value={currentUser}>{children}</AuthContext.Provider>
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
