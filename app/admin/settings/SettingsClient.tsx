'use client'

import { useState, useTransition, useRef } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import {
  updateSettingAction,
  getLogoSignedUploadUrlAction, finalizeLogoUploadAction,
  getHeroBannerSignedUploadUrlAction, finalizeHeroBannerUploadAction, removeHeroBannerAction,
} from './actions'

type Setting = { key: string; value: unknown }
type Props = { settings: Setting[] }

const S = {
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: '24px 28px',
    marginBottom: 20,
  } as React.CSSProperties,
  label: {
    display: 'block', fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 4,
  } as React.CSSProperties,
  desc: { fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.4 } as React.CSSProperties,
  btn: (color: string, bg: string, disabled = false): React.CSSProperties => ({
    padding: '8px 18px', background: disabled ? '#d1d5db' : bg, color, border: 'none', borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, opacity: disabled ? 0.6 : 1,
  }),
  textarea: {
    padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: 14, width: '100%', minHeight: 100, resize: 'vertical' as const,
    boxSizing: 'border-box' as const, fontFamily: 'inherit',
  } as React.CSSProperties,
}

function InfoBanner({ text }: { text: string }) {
  return (
    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 16 }}>
      {text}
    </div>
  )
}

function LogoUploadCard({ currentUrl }: { currentUrl: string }) {
  const [preview, setPreview] = useState(currentUrl || '/fc-logo.svg')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const ext = (file.name.split('.').pop()?.toLowerCase() ?? 'png') as 'jpg' | 'jpeg' | 'png' | 'webp' | 'svg'
      const res = await getLogoSignedUploadUrlAction(ext)
      if (res.error) throw new Error(res.error)

      const uploadRes = await fetch(res.signedUrl!, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadRes.ok) throw new Error('Upload failed')

      const finalRes = await finalizeLogoUploadAction(res.storagePath!)
      if (finalRes.error) throw new Error(finalRes.error)

      setPreview(finalRes.url!)
      setFile(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError((e as Error).message)
    }
    setUploading(false)
  }

  return (
    <div style={S.card}>
      <div style={S.label}>App Logo</div>
      <div style={S.desc}>
        Upload a custom logo. It appears as a circular icon in the navigation bar.
        Recommended: square image, PNG or SVG, min 128×128 px.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20 }}>
        {/* Circle preview */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          border: '2px solid #DC2626',
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 2px 12px rgba(220,38,38,0.2)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Logo preview"
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
          />
        </div>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setFile(f)
              setError('')
              const reader = new FileReader()
              reader.onload = (ev) => setPreview(ev.target?.result as string)
              reader.readAsDataURL(f)
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            style={S.btn('#374151', '#f3f4f6')}
          >
            Choose Image
          </button>
          {file && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </div>
          )}
        </div>
      </div>

      {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={S.btn('#fff', '#DC2626', !file || uploading)}
        >
          {uploading ? 'Uploading…' : 'Save Logo'}
        </button>
        {saved && (
          <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
            ✓ Logo updated — refresh the page to see changes
          </span>
        )}
      </div>
    </div>
  )
}

function HeroBannerCard({ currentUrl }: { currentUrl: string }) {
  const [preview, setPreview] = useState(currentUrl || '')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const ext = (file.name.split('.').pop()?.toLowerCase() ?? 'jpg') as 'jpg' | 'jpeg' | 'png' | 'webp'
      const res = await getHeroBannerSignedUploadUrlAction(ext)
      if (res.error) throw new Error(res.error)

      const uploadRes = await fetch(res.signedUrl!, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadRes.ok) throw new Error('Upload failed')

      const finalRes = await finalizeHeroBannerUploadAction(res.storagePath!)
      if (finalRes.error) throw new Error(finalRes.error)

      setPreview(finalRes.url!)
      setFile(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError((e as Error).message)
    }
    setUploading(false)
  }

  async function handleRemove() {
    setRemoving(true)
    setError('')
    try {
      const res = await removeHeroBannerAction()
      if (res.error) throw new Error(res.error)
      setPreview('')
      setFile(null)
    } catch (e) {
      setError((e as Error).message)
    }
    setRemoving(false)
  }

  return (
    <div style={S.card}>
      <div style={S.label}>Homepage Hero Banner</div>
      <div style={S.desc}>
        Upload a full-width hero image displayed at the top of the homepage when users sign in.
        Recommended: landscape photo, JPG or PNG, min 750×400 px. Faces/subjects should be in the upper half.
      </div>

      {/* Preview */}
      {preview && (
        <div style={{
          width: '100%', height: 160, borderRadius: 10, overflow: 'hidden',
          marginBottom: 16, position: 'relative',
          background: '#0C0C0C',
          border: '1px solid #e5e7eb',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Hero banner preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.65) 100%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: 10, left: 12,
            fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.7)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Preview
          </div>
        </div>
      )}

      {!preview && (
        <div style={{
          width: '100%', height: 100, borderRadius: 10, marginBottom: 16,
          background: '#0C0C0C', border: '2px dashed #d1d5db',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: '#9ca3af',
        }}>
          No hero banner set — homepage shows player mosaic
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (!f) return
            setFile(f)
            setError('')
            const reader = new FileReader()
            reader.onload = (ev) => setPreview(ev.target?.result as string)
            reader.readAsDataURL(f)
          }}
        />
        <button onClick={() => inputRef.current?.click()} style={S.btn('#374151', '#f3f4f6')}>
          Choose Image
        </button>
        {file && (
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </span>
        )}
      </div>

      {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={S.btn('#fff', '#DC2626', !file || uploading)}
        >
          {uploading ? 'Uploading…' : 'Save Banner'}
        </button>
        {currentUrl && (
          <button
            onClick={handleRemove}
            disabled={removing}
            style={S.btn('#374151', '#f3f4f6', removing)}
          >
            {removing ? 'Removing…' : 'Remove Banner'}
          </button>
        )}
        {saved && (
          <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
            ✓ Banner updated — refresh homepage to see changes
          </span>
        )}
      </div>
    </div>
  )
}

function GameplayRulesCard({ current }: { current: string }) {
  const { t } = useTranslation()
  const [value, setValue]    = useState(current)
  const [saved, setSaved]    = useState(false)
  const [error, setError]    = useState('')
  const [pending, start]     = useTransition()

  function save() {
    start(async () => {
      try {
        await updateSettingAction('gameplay_rules', value)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        setError('')
      } catch (e) {
        setError((e as Error).message)
      }
    })
  }

  return (
    <div style={S.card}>
      <div style={S.label}>{t('admin.settings.rulesTitle')}</div>
      <div style={S.desc}>{t('admin.settings.rulesDesc')}</div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={S.textarea}
        placeholder={t('admin.settings.rulesPlaceholder')}
      />
      {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '8px 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
        <button onClick={save} disabled={pending} style={S.btn('#fff', '#2563eb')}>
          {pending ? t('common.saving') : t('admin.settings.saveRules')}
        </button>
        {saved && <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{t('admin.settings.saved')}</span>}
      </div>
    </div>
  )
}

function EditWindowCard() {
  const { t } = useTranslation()
  return (
    <div style={S.card}>
      <div style={S.label}>{t('admin.settings.windowTitle')}</div>
      <div style={S.desc}>{t('admin.settings.windowDesc')}</div>
      <InfoBanner text={t('admin.settings.windowHint')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="number"
          defaultValue={4}
          disabled
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: 80, opacity: 0.5, cursor: 'not-allowed' }}
        />
        <span style={{ fontSize: 14, color: '#6b7280' }}>{t('admin.settings.windowUnit')}</span>
      </div>
    </div>
  )
}

function OddsFormatCard() {
  const { t } = useTranslation()
  return (
    <div style={S.card}>
      <div style={S.label}>{t('admin.settings.oddsTitle')}</div>
      <div style={S.desc}>{t('admin.settings.oddsDesc')}</div>
      <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
        {t('admin.settings.oddsNote')}
      </div>
    </div>
  )
}

export function SettingsClient({ settings }: Props) {
  const { t } = useTranslation()
  const get = (key: string, fallback: string) => {
    const s = settings.find((s) => s.key === key)
    return s ? String(s.value).replace(/^"|"$/g, '') : fallback
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 720 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#111827' }}>{t('admin.settings.title')}</h1>
      <p style={{ margin: '0 0 28px', fontSize: 13, color: '#6b7280' }}>{t('admin.settings.subtitle')}</p>

      <LogoUploadCard currentUrl={get('logo_url', '')} />
      <HeroBannerCard currentUrl={get('homepage_hero_url', '')} />
      <GameplayRulesCard current={get('gameplay_rules', '')} />
      <EditWindowCard />
      <OddsFormatCard />
    </div>
  )
}
