import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { AuthProvider } from '@/lib/auth/use-auth'
import { I18nProvider } from '@/lib/i18n/context'
import { BetSlipProvider } from '@/lib/betting/BetSlipContext'
import { AppChrome } from '@/app/components/AppChrome'
import type { Locale } from '@/lib/i18n/translations'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  icons: {
    icon: '/fc-logo.svg',
    apple: '/apple-touch-icon.png',
  },
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  const user = session
    ? { userId: session.sub, isAdmin: session.isAdmin }
    : null

  const cookieStore = await cookies()
  const rawLang = cookieStore.get('lang')?.value
  const locale: Locale = rawLang === 'ru' ? 'ru' : 'en'
  const theme = cookieStore.get('theme')?.value === 'dark' ? 'dark' : 'light'

  return (
    <html lang={locale} data-theme={theme}>
      <body className={user && !user.isAdmin ? 'has-player-navigation' : undefined}>
        <I18nProvider initialLocale={locale}>
          <BetSlipProvider>
            <AuthProvider user={user}>
              {children}
              <AppChrome />
            </AuthProvider>
          </BetSlipProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
