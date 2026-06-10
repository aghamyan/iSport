import './globals.css'
import type { ReactNode } from 'react'
import { getSession } from '@/lib/auth/session'
import { AuthProvider } from '@/lib/auth/use-auth'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  const user = session
    ? { userId: session.sub, isAdmin: session.isAdmin }
    : null

  return (
    <html lang="en">
      <body>
        {/* AuthProvider bridges server-read session to client components */}
        <AuthProvider user={user}>{children}</AuthProvider>
      </body>
    </html>
  )
}
