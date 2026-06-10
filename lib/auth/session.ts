import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'sb-session'
const DEFAULT_DURATION_DAYS = Number(process.env.SESSION_DURATION_DAYS ?? 30)

export type SessionPayload = {
  sub: string      // userId — maps to auth.uid() in Supabase RLS
  role: 'authenticated'
  isAdmin: boolean
  sessionId: string
  iat: number
  exp: number
}

function getSecret() {
  const s = process.env.SUPABASE_JWT_SECRET
  if (!s) throw new Error('SUPABASE_JWT_SECRET is not set')
  return new TextEncoder().encode(s)
}

/**
 * Signs a Supabase-compatible HS256 JWT and writes it as an httpOnly cookie.
 * The JWT's `sub` claim becomes auth.uid() inside Supabase RLS policies,
 * so this token must be signed with the project's SUPABASE_JWT_SECRET.
 */
export async function createSession(
  userId: string,
  isAdmin: boolean,
  sessionId: string,
  durationDays = DEFAULT_DURATION_DAYS
): Promise<string> {
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)

  const token = await new SignJWT({
    sub: userId,
    role: 'authenticated' as const,
    aud: 'authenticated',
    isAdmin,
    sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('supabase')
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  })

  return token
}

/** Returns the decoded session, or null if the cookie is missing or expired. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

/** Returns the raw JWT string from the cookie (needed to build the user client). */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
