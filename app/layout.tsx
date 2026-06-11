import './globals.css'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { AuthProvider } from '@/lib/auth/use-auth'
import { I18nProvider } from '@/lib/i18n/context'
import { LanguageSwitcher } from '@/app/components/LanguageSwitcher'
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
          {/* AuthProvider bridges server-read session to client components */}
          <AuthProvider user={user}>{children}</AuthProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
