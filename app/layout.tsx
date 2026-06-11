import './globals.css'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { AuthProvider } from '@/lib/auth/use-auth'
import { I18nProvider } from '@/lib/i18n/context'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'
import { BetSlipProvider } from '@/lib/betting/BetSlipContext'
import { BetSlip } from '@/app/betting/BetSlip'
import type { Locale } from '@/lib/i18n/translations'

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

  const cookieStore = await cookies()
  const rawLang = cookieStore.get('lang')?.value
  const locale: Locale = rawLang === 'ru' ? 'ru' : 'en'

  return (
    <html lang={locale}>
      <body>
        <I18nProvider initialLocale={locale}>
          <LanguageSwitcher />
          <BetSlipProvider>
            {/* AuthProvider bridges server-read session to client components */}
            <AuthProvider user={user}>{children}</AuthProvider>
            {/* Global bet slip — renders as sticky bottom sheet for logged-in non-admin players */}
            {user && !user.isAdmin && <BetSlip userId={user.userId} />}
          </BetSlipProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
