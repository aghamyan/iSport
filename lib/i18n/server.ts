import { cookies } from 'next/headers'
import { en, ru, type Locale, type Dict } from './translations'

const dicts: Record<Locale, Dict> = { en, ru }

export async function getServerT() {
  const cookieStore = await cookies()
  const raw = cookieStore.get('lang')?.value
  const locale: Locale = raw === 'ru' ? 'ru' : 'en'
  const dict = dicts[locale]

  return function t(key: string, params?: Record<string, string | number>): string {
    const str = (dict as Record<string, string>)[key] ?? key
    if (!params) return str
    return Object.entries(params).reduce(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      str,
    )
  }
}
