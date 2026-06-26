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
    <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #3b0000 0%, #0f0000 50%, #000000 100%)' }}>

      {/* Background decorative rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full border border-red-900/20 absolute" />
        <div className="w-[800px] h-[800px] rounded-full border border-red-900/10 absolute" />
        <div className="w-[1000px] h-[1000px] rounded-full border border-red-900/5 absolute" />
      </div>

      {/* Red glow top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(185,28,28,0.25) 0%, transparent 70%)' }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo / Title */}
        <div className="mb-8 text-center">
          {/* Trophy icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'radial-gradient(circle, #7f1d1d, #450a0a)', boxShadow: '0 0 30px rgba(185,28,28,0.5), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-red-300" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 17H7.83C7.42 18.17 6.31 19 5 19c-1.66 0-3-1.34-3-3s1.34-3 3-3c1.31 0 2.42.83 2.83 2H11v-2h2v2h2V9h2V7h-2V3H7v4H5v2h2v6H5.83C5.42 13.83 4.31 13 3 13c-1.66 0-3 1.34-3 3s1.34 3 3 3c1.31 0 2.42-.83 2.83-2H11v2h2v-2h4.17c.41 1.17 1.52 2 2.83 2 1.66 0 3-1.34 3-3s-1.34-3-3-3c-1.31 0-2.42.83-2.83 2H13v-2h-2v2zm-2-8h6v2h-6V9z"/>
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-black tracking-widest uppercase text-white"
            style={{ textShadow: '0 0 30px rgba(239,68,68,0.6), 0 2px 4px rgba(0,0,0,0.8)', letterSpacing: '0.15em' }}>
            ULTIMATE FC
          </h1>
          <p className="text-xs font-bold tracking-[0.3em] uppercase mt-1"
            style={{ color: '#ef4444', textShadow: '0 0 10px rgba(239,68,68,0.5)' }}>
            CHAMPIONSHIP
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="h-px flex-1 max-w-[60px]" style={{ background: 'linear-gradient(to right, transparent, #7f1d1d)' }} />
            <span className="text-xs text-red-900 tracking-widest">✦</span>
            <div className="h-px flex-1 max-w-[60px]" style={{ background: 'linear-gradient(to left, transparent, #7f1d1d)' }} />
          </div>
          <p className="mt-3 text-xs text-red-900/70 tracking-wide">{t('auth.tagline')}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8"
          style={{
            background: 'linear-gradient(135deg, rgba(30,0,0,0.95) 0%, rgba(15,0,0,0.98) 100%)',
            border: '1px solid rgba(185,28,28,0.3)',
            boxShadow: '0 0 40px rgba(185,28,28,0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
          }}>
          <form action={formAction} className="space-y-5">
            <div>
              <label
                htmlFor="accessCode"
                className="block text-xs font-bold tracking-widest uppercase mb-2"
                style={{ color: '#f87171' }}
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
                className="w-full rounded-lg px-4 py-3 font-mono tracking-[0.2em] text-white placeholder-red-900/50 uppercase focus:outline-none"
                style={{
                  background: 'rgba(127,29,29,0.15)',
                  border: '1px solid rgba(185,28,28,0.4)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = 'rgba(239,68,68,0.8)'
                  e.currentTarget.style.boxShadow = '0 0 0 2px rgba(185,28,28,0.3)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = 'rgba(185,28,28,0.4)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
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
              className="w-full rounded-lg py-3 text-sm font-black tracking-widest uppercase text-white disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 50%, #991b1b 100%)',
                boxShadow: '0 0 20px rgba(185,28,28,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
              }}
              onMouseEnter={e => {
                if (!pending) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 50%, #b91c1c 100%)'
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(185,28,28,0.6), inset 0 1px 0 rgba(255,255,255,0.15)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 50%, #991b1b 100%)'
                e.currentTarget.style.boxShadow = '0 0 20px rgba(185,28,28,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              {pending ? t('auth.verifying') : t('auth.enter')}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: '#450a0a' }}>
          {t('auth.noCode')}
        </p>
      </div>
    </main>
  )
}
