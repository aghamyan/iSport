'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from '@/lib/i18n/context'
import {
  updateSettingAction,
  getLogoSignedUploadUrlAction, finalizeLogoUploadAction,
  getHeroBannerSignedUploadUrlAction, finalizeHeroBannerUploadAction, removeHeroBannerAction,
  updateHeroBannerPositionAction,
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

function HeroBannerPositionModal({
  previewSrc,
  initialPosition,
  onConfirm,
  onCancel,
}: {
  previewSrc: string
  initialPosition: string
  onConfirm: (position: string) => void
  onCancel: () => void
}) {
  const parse = (s: string): [number, number] => {
    const [x, y] = s.split(' ').map(parseFloat)
    return [isNaN(x) ? 50 : x, isNaN(y) ? 0 : y]
  }
  const [init] = useState(() => parse(initialPosition))
  const [posX, setPosX] = useState(init[0])
  const [posY, setPosY] = useState(init[1])
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [frame, setFrame] = useState({ w: 640, h: 154 })

  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const maxDragRef = useRef({ x: 0, y: 0 })

  // Responsive frame size — mirrors the homepage hero banner's full-width, 216px-tall bleed
  useEffect(() => {
    function calc() {
      const vw = Math.min(window.innerWidth - 48, 720)
      const w = Math.round(vw)
      const h = Math.min(216, Math.round(w / 2.2))
      setFrame({ w, h })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  useEffect(() => {
    if (nat.w === 0) return
    const scale = Math.max(frame.w / nat.w, frame.h / nat.h)
    maxDragRef.current = {
      x: Math.max(0, nat.w * scale - frame.w),
      y: Math.max(0, nat.h * scale - frame.h),
    }
  }, [nat, frame])

  const applyDelta = useCallback((dx: number, dy: number) => {
    const { x: mX, y: mY } = maxDragRef.current
    if (mX > 0) {
      setPosX((p) => {
        const newOff = -(p / 100) * mX + dx
        return Math.max(0, Math.min(100, (-newOff / mX) * 100))
      })
    }
    if (mY > 0) {
      setPosY((p) => {
        const newOff = -(p / 100) * mY + dy
        return Math.max(0, Math.min(100, (-newOff / mY) * 100))
      })
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const dx = e.clientX - lastMouse.current.x
      const dy = e.clientY - lastMouse.current.y
      lastMouse.current = { x: e.clientX, y: e.clientY }
      applyDelta(dx, dy)
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [applyDelta])

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true
    lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return
    e.preventDefault()
    const t = e.touches[0]
    const dx = t.clientX - lastMouse.current.x
    const dy = t.clientY - lastMouse.current.y
    lastMouse.current = { x: t.clientX, y: t.clientY }
    applyDelta(dx, dy)
  }
  const handleTouchEnd = () => { isDragging.current = false }

  const scale = nat.w > 0 ? Math.max(frame.w / nat.w, frame.h / nat.h) : 1
  const sw = nat.w * scale
  const sh = nat.h * scale
  const { x: mX, y: mY } = maxDragRef.current
  const imgL = -(posX / 100) * mX
  const imgT = -(posY / 100) * mY

  const posStr = `${Math.round(posX)}% ${Math.round(posY)}%`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
          Position Hero Banner
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>
          Drag to choose which area is shown on the homepage
        </div>
      </div>

      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: frame.w, height: frame.h, flexShrink: 0,
          overflow: 'hidden', position: 'relative',
          cursor: 'grab', userSelect: 'none', touchAction: 'none',
          borderRadius: 6,
          boxShadow: '0 0 0 2px #DC2626, 0 0 32px 0 rgba(220,38,38,0.25)',
          background: '#0C0C0C',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewSrc}
          alt="preview"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget
            setNat({ w: img.naturalWidth, h: img.naturalHeight })
          }}
          style={{
            position: 'absolute',
            width: sw > 0 ? sw : '100%',
            height: sw > 0 ? sh : '100%',
            left: imgL, top: imgT,
            pointerEvents: 'none', userSelect: 'none',
            objectFit: sw > 0 ? 'unset' : 'cover',
          }}
        />

        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.18) 40%, rgba(12,12,12,0.78) 100%)',
        }} />

        {nat.w === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, letterSpacing: '0.06em' }}>
            Loading…
          </div>
        )}

        {nat.w > 0 && (
          <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '5px 14px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ↔ Drag to reposition
            </div>
          </div>
        )}
      </div>

      {nat.w > 0 && mY > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: frame.w, maxWidth: '100%' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Top</span>
          <input
            type="range" min={0} max={100} value={Math.round(posY)}
            onChange={(e) => setPosY(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#DC2626', height: 3, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Bottom</span>
        </div>
      )}
      {nat.w > 0 && mX > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: frame.w, maxWidth: '100%' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Left</span>
          <input
            type="range" min={0} max={100} value={Math.round(posX)}
            onChange={(e) => setPosX(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#DC2626', height: 3, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Right</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onCancel}
          style={{ padding: '10px 28px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em' }}
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(posStr)}
          style={{ padding: '10px 36px', background: '#DC2626', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

function HeroBannerCard({ currentUrl, currentPosition }: { currentUrl: string; currentPosition: string }) {
  const [preview, setPreview] = useState(currentUrl || '')
  const [position, setPosition] = useState(currentPosition || '50% 0%')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [repositioning, setRepositioning] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [showPosModal, setShowPosModal] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropSrc, setCropSrc] = useState('')

  function handleFileChosen(f: File) {
    setError('')
    const objUrl = URL.createObjectURL(f)
    setCropFile(f)
    setCropSrc(objUrl)
    setShowPosModal(true)
  }

  function handleOpenReposition() {
    if (!preview || file) return
    setCropFile(null)
    setCropSrc(preview)
    setShowPosModal(true)
  }

  function handlePosCancel() {
    setShowPosModal(false)
    if (cropFile) URL.revokeObjectURL(cropSrc)
    setCropFile(null)
    setCropSrc('')
  }

  function handlePosConfirm(newPosition: string) {
    setShowPosModal(false)
    if (cropFile) {
      // New image staged — apply chosen position once "Save Banner" is clicked
      const f = cropFile
      URL.revokeObjectURL(cropSrc)
      setCropFile(null)
      setCropSrc('')
      setFile(f)
      setPosition(newPosition)
      const reader = new FileReader()
      reader.onload = (ev) => setPreview(ev.target?.result as string)
      reader.readAsDataURL(f)
    } else {
      // Repositioning the already-saved banner — persist immediately
      setCropSrc('')
      setPosition(newPosition)
      setRepositioning(true)
      setError('')
      updateHeroBannerPositionAction(newPosition)
        .then((res) => {
          if (res.error) throw new Error(res.error)
          setSaved(true)
          setTimeout(() => setSaved(false), 2500)
        })
        .catch((e) => setError((e as Error).message))
        .finally(() => setRepositioning(false))
    }
  }

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

      const finalRes = await finalizeHeroBannerUploadAction(res.storagePath!, position)
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
      setPosition('50% 0%')
    } catch (e) {
      setError((e as Error).message)
    }
    setRemoving(false)
  }

  return (
    <div style={S.card}>
      {showPosModal && cropSrc && (
        <HeroBannerPositionModal
          previewSrc={cropSrc}
          initialPosition={position}
          onConfirm={handlePosConfirm}
          onCancel={handlePosCancel}
        />
      )}

      <div style={S.label}>Homepage Hero Banner</div>
      <div style={S.desc}>
        Upload a full-width hero image displayed at the top of the homepage when users sign in.
        Recommended: landscape photo, JPG or PNG, min 750×400 px. Use Reposition to choose which area is shown.
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
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: position, display: 'block' }}
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
          {!file && (
            <button
              onClick={handleOpenReposition}
              disabled={repositioning}
              style={{
                position: 'absolute', top: 10, right: 10,
                padding: '6px 12px', borderRadius: 6, border: 'none',
                background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                cursor: repositioning ? 'not-allowed' : 'pointer', opacity: repositioning ? 0.6 : 1,
              }}
            >
              {repositioning ? 'Saving…' : 'Reposition'}
            </button>
          )}
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
            e.target.value = ''
            handleFileChosen(f)
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
      <HeroBannerCard currentUrl={get('homepage_hero_url', '')} currentPosition={get('homepage_hero_position', '50% 0%')} />
      <GameplayRulesCard current={get('gameplay_rules', '')} />
      <EditWindowCard />
      <OddsFormatCard />
    </div>
  )
}
