import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// Routes that require a logged-in user
const PROTECTED_PREFIXES = [
  '/matches/new',
  '/matches/edit',
  '/championships/new',
  '/championships/edit',
  '/championship',  // covers /championship/[id]/edit etc.
  '/dashboard',
]

// Routes that additionally require is_admin === true
const ADMIN_PREFIXES = ['/admin']

function getSecret() {
  const s = process.env.SUPABASE_JWT_SECRET
  if (!s) throw new Error('SUPABASE_JWT_SECRET is not set')
  return new TextEncoder().encode(s)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  const isAdmin     = ADMIN_PREFIXES.some(p => pathname.startsWith(p))
  const isLoginPage = pathname === '/login'

  // Fast-path: no JWT needed for public routes
  if (!isProtected && !isAdmin && !isLoginPage) {
    return NextResponse.next()
  }

  const token = request.cookies.get('sb-session')?.value

  let session: { sub: string; isAdmin: boolean } | null = null
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret())
      session = payload as unknown as { sub: string; isAdmin: boolean }
    } catch {
      // expired or tampered — treat as logged-out
    }
  }

  // Already authenticated — redirect away from login
  if (isLoginPage && session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Protected route with no session — send to login
  if ((isProtected || isAdmin) && !session) {
    const url = new URL('/login', request.url)
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  // Admin route with non-admin session — redirect home
  if (isAdmin && !session?.isAdmin) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Skip Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
