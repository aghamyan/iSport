'use client'

import { useActionState } from 'react'
import { loginAction, type LoginState } from '@/lib/auth/actions'
import { useTranslation } from '@/lib/i18n/context'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    null
  )
  const { t } = useTranslation()

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">iSport</h1>
          <p className="mt-2 text-sm text-gray-400">{t('auth.tagline')}</p>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
          <form action={formAction} className="space-y-5">
            <div>
              <label
                htmlFor="accessCode"
                className="block text-sm font-medium text-gray-300 mb-1.5"
              >
                {t('auth.accessCode')}
              </label>
              <input
                id="accessCode"
                name="accessCode"
                type="text"
                autoComplete="off"
                autoFocus
                spellCheck={false}
                placeholder="XXXX-XXXX"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3
                           font-mono tracking-[0.2em] text-white placeholder-gray-600 uppercase
                           focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {state?.error && (
              <p role="alert" className="text-sm text-red-400">
                {t(state.error)}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white
                         transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2
                         focus-visible:outline-offset-2 focus-visible:outline-blue-500
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? t('auth.verifying') : t('auth.enter')}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          {t('auth.noCode')}
        </p>
      </div>
    </main>
  )
}
