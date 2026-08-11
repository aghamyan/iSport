import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  const user = session
    ? { userId: session.sub, isAdmin: session.isAdmin }
    : null

  return NextResponse.json(
    { user },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
