'use client'

import { useState, useTransition, useRef, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Eye, EyeOff, Upload, X, Image as ImageIcon, Move } from 'lucide-react'
import {
  createNewsAction,
  updateNewsAction,
  deleteNewsAction,
  getSignedNewsPhotoUrl,
  finalizeNewsPhotoUpload,
  updateNewsPhotoPositionAction,
} from '@/app/news/newsActions'
import { coverImageStyle } from '@/app/news/coverImageStyle'

export interface AdminNewsItem {
  id: string
  title: string
  category: string
  excerpt: string | null
  content: string | null
  coverUrl: string | null
  coverPosition: string
  coverZoom: number
  published: boolean
  createdAt: string
}

const CATEGORIES = ['NEWS', 'RESULTS', 'PREVIEW', 'INTERVIEW', 'ANALYSIS', 'TRANSFER']

const EMPTY_FORM = {
  title: '',
  category: 'NEWS',
  excerpt: '',
  content: '',
  published: true,
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days >= 1) return `${days}d ago`
  const h = Math.floor(diff / 3_600_000)
  return h >= 1 ? `${h}h ago` : 'just now'
}

const MIN_ZOOM = 1
const MAX_ZOOM = 3

// ── Cover position modal — drag to choose which area of the image shows ───
function CoverPositionModal({
  previewSrc,
  initialPosition,
  initialZoom,
  onConfirm,
  onCancel,
}: {
  previewSrc: string
  initialPosition: string
  initialZoom: number
  onConfirm: (position: string, zoom: number) => void
  onCancel: () => void
}) {
  const parse = (s: string): [number, number] => {
    const [x, y] = s.split(' ').map(parseFloat)
    return [isNaN(x) ? 50 : x, isNaN(y) ? 50 : y]
  }
  const [init] = useState(() => parse(initialPosition))
  const [posX, setPosX] = useState(init[0])
  const [posY, setPosY] = useState(init[1])
  const [zoom, setZoom] = useState(() => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialZoom || 1)))
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [frame, setFrame] = useState({ w: 640, h: 360 })

  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const maxDragRef = useRef({ x: 0, y: 0 })

  // Responsive 16:9 frame, matching the cover image's real aspect ratio
  useEffect(() => {
    function calc() {
      const vw = Math.min(window.innerWidth - 48, 720)
      const w = Math.round(vw)
      const h = Math.round((w * 9) / 16)
      setFrame({ w, h })
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  useEffect(() => {
    if (nat.w === 0) return
    const scale = Math.max(frame.w / nat.w, frame.h / nat.h) * zoom
    maxDragRef.current = {
      x: Math.max(0, nat.w * scale - frame.w),
      y: Math.max(0, nat.h * scale - frame.h),
    }
  }, [nat, frame, zoom])

  const applyDelta = useCallback((dx: number, dy: number) => {
    const { x: mX, y: mY } = maxDragRef.current
    if (mX > 0) {
      setPosX(p => {
        const newOff = -(p / 100) * mX + dx
        return Math.max(0, Math.min(100, (-newOff / mX) * 100))
      })
    }
    if (mY > 0) {
      setPosY(p => {
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

  const scale = nat.w > 0 ? Math.max(frame.w / nat.w, frame.h / nat.h) * zoom : 1
  const sw = nat.w * scale
  const sh = nat.h * scale
  const { x: mX, y: mY } = maxDragRef.current
  const imgL = -(posX / 100) * mX
  const imgT = -(posY / 100) * mY

  const posStr = `${Math.round(posX)}% ${Math.round(posY)}%`

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.0015)))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 8 }}>
          Position Cover Image
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em' }}>
          Drag to choose which area is shown in the frame
        </div>
      </div>

      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{
          width: frame.w, height: frame.h, flexShrink: 0,
          overflow: 'hidden', position: 'relative',
          cursor: 'grab', userSelect: 'none', touchAction: 'none',
          borderRadius: 6,
          boxShadow: '0 0 0 2px #DC2626, 0 0 32px 0 rgba(220,38,38,0.25)',
          background: '#0a0a0a',
        }}
      >
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

        {/* Rule-of-thirds grid */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.1 }}>
          {['33.3%', '66.6%'].map((v) => (
            <div key={`v${v}`} style={{ position: 'absolute', left: v, top: 0, bottom: 0, width: 1, background: '#fff' }} />
          ))}
          {['33.3%', '66.6%'].map((v) => (
            <div key={`h${v}`} style={{ position: 'absolute', top: v, left: 0, right: 0, height: 1, background: '#fff' }} />
          ))}
        </div>

        {nat.w === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, letterSpacing: '0.06em' }}>
            Loading…
          </div>
        )}

        {nat.w > 0 && (
          <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '5px 14px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ↕ Drag to reposition · Scroll to zoom
            </div>
          </div>
        )}
      </div>

      {nat.w > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: frame.w, maxWidth: '100%' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Zoom</span>
          <input
            type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#DC2626', height: 3, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap', minWidth: 38, textAlign: 'right' }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>
      )}

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
          onClick={() => onConfirm(posStr, Math.round(zoom * 100) / 100)}
          style={{ padding: '10px 36px', background: '#DC2626', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

// ── Cover image uploader ──────────────────────────────────────────────────
function CoverUploader({
  newsId,
  currentUrl,
  currentPosition,
  currentZoom,
  onUploaded,
  onPositioned,
}: {
  newsId: string
  currentUrl: string | null
  currentPosition: string
  currentZoom: number
  onUploaded: (url: string) => void
  onPositioned: (position: string, zoom: number) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [position, setPosition] = useState(currentPosition)
  const [zoom, setZoom] = useState(currentZoom)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Crop/position modal state — null cropFile means "reposition existing photo"
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropSrc, setCropSrc] = useState<string>('')
  const [showCrop, setShowCrop] = useState(false)

  function handlePick(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() as 'jpg' | 'jpeg' | 'png' | 'webp'
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      setError('Use JPG, PNG or WebP')
      return
    }
    setError(null)
    const objUrl = URL.createObjectURL(file)
    setCropFile(file)
    setCropSrc(objUrl)
    setShowCrop(true)
  }

  function handleOpenReposition() {
    if (!preview) return
    setCropFile(null)
    setCropSrc(preview)
    setShowCrop(true)
  }

  function handleCropCancel() {
    setShowCrop(false)
    if (cropFile) URL.revokeObjectURL(cropSrc)
    setCropFile(null)
    setCropSrc('')
  }

  async function handleCropConfirm(pos: string, z: number) {
    setShowCrop(false)
    if (cropFile) {
      const file = cropFile
      URL.revokeObjectURL(cropSrc)
      setCropFile(null)
      setCropSrc('')
      const ext = file.name.split('.').pop()?.toLowerCase() as 'jpg' | 'jpeg' | 'png' | 'webp'
      setUploading(true)

      const { signedUrl, storagePath, error: urlErr } = await getSignedNewsPhotoUrl(newsId, ext)
      if (urlErr || !signedUrl || !storagePath) {
        setError(urlErr ?? 'Failed')
        setUploading(false)
        return
      }

      const res = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!res.ok) {
        setError('Upload failed')
        setUploading(false)
        return
      }

      const { url, error: finErr } = await finalizeNewsPhotoUpload(newsId, storagePath, pos, z)
      if (finErr || !url) {
        setError(finErr ?? 'Finalize failed')
      } else {
        setPreview(url)
        setPosition(pos)
        setZoom(z)
        onUploaded(url)
        onPositioned(pos, z)
      }
      setUploading(false)
    } else {
      // Reposition only — no re-upload
      setCropSrc('')
      const r = await updateNewsPhotoPositionAction(newsId, pos, z)
      if (r.error) setError(r.error)
      else { setPosition(pos); setZoom(z); onPositioned(pos, z) }
    }
  }

  return (
    <div>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: `2px dashed ${preview ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 8,
          cursor: uploading ? 'default' : 'pointer',
          overflow: 'hidden',
          background: 'var(--card2)',
          position: 'relative',
          aspectRatio: '16/9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 0.15s',
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Cover"
            style={{ width: '100%', height: '100%', display: 'block', ...coverImageStyle(position, zoom) }}
          />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
            <ImageIcon size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              {uploading ? 'Uploading…' : 'Click to upload cover image'}
            </div>
            <div style={{ fontSize: 10, marginTop: 4, opacity: 0.7 }}>JPG, PNG or WebP</div>
          </div>
        )}

        {uploading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Uploading…</div>
          </div>
        )}

        {preview && !uploading && (
          <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleOpenReposition() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 6,
                padding: '4px 10px', fontSize: 10, fontWeight: 700, color: '#fff',
                letterSpacing: '0.06em', cursor: 'pointer',
              }}
            >
              <Move size={11} /> REPOSITION
            </button>
            <div style={{
              background: 'rgba(0,0,0,0.7)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.06em',
            }}>
              Click to replace
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handlePick(f)
          e.target.value = ''
        }}
      />
      {error && <p style={{ color: 'var(--accent)', fontSize: 11, marginTop: 6 }}>{error}</p>}

      {showCrop && cropSrc && (
        <CoverPositionModal
          previewSrc={cropSrc}
          initialPosition={position}
          initialZoom={zoom}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  )
}

// ── News Form Modal ────────────────────────────────────────────────────────
function NewsModal({
  item,
  onClose,
  onSaved,
}: {
  item: AdminNewsItem | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!item
  const [form, setForm] = useState({
    title:     item?.title     ?? EMPTY_FORM.title,
    category:  item?.category  ?? EMPTY_FORM.category,
    excerpt:   item?.excerpt   ?? EMPTY_FORM.excerpt,
    content:   item?.content   ?? EMPTY_FORM.content,
    published: item?.published ?? EMPTY_FORM.published,
  })
  const [savedId, setSavedId] = useState<string | null>(item?.id ?? null)
  const [coverUrl, setCoverUrl] = useState<string | null>(item?.coverUrl ?? null)
  const [coverPosition, setCoverPosition] = useState<string>(item?.coverPosition ?? '50% 50%')
  const [coverZoom, setCoverZoom] = useState<number>(item?.coverZoom ?? 1)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setError(null)
    if (!form.title.trim()) { setError('Title is required'); return }

    startTransition(async () => {
      if (isEdit && item) {
        const res = await updateNewsAction(item.id, form)
        if (res.error) { setError(res.error); return }
        setSaved(true)
        onSaved()
      } else {
        const res = await createNewsAction(form)
        if (res.error) { setError(res.error); return }
        setSavedId(res.id ?? null)
        setSaved(true)
        onSaved()
      }
    })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--card2)',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase',
    display: 'block', marginBottom: 5,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 16px',
      overflowY: 'auto',
    }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--card)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 700,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 3, height: 20, background: 'var(--accent)', borderRadius: 2 }} />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              {isEdit ? 'EDIT ARTICLE' : 'CREATE ARTICLE'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              cursor: 'pointer', color: 'var(--muted)',
              display: 'flex', alignItems: 'center', padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Title */}
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              style={inputStyle}
              placeholder="MAIN CARD RESULTS | CHAMPIONSHIP NIGHT…"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          {/* Category + Published row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    onClick={() => setForm({ ...form, published: val })}
                    style={{
                      flex: 1, padding: '9px 12px',
                      borderRadius: 6,
                      border: `1px solid ${form.published === val ? 'var(--accent)' : 'var(--border)'}`,
                      background: form.published === val ? 'rgba(var(--rgb-accent),0.08)' : 'var(--card2)',
                      color: form.published === val ? 'var(--accent)' : 'var(--muted)',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {val ? 'PUBLISHED' : 'DRAFT'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Excerpt */}
          <div>
            <label style={labelStyle}>Excerpt / Lead</label>
            <textarea
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical', lineHeight: 1.5 }}
              placeholder="Short description shown in the news list…"
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            />
          </div>

          {/* Content */}
          <div>
            <label style={labelStyle}>Article Content</label>
            <textarea
              style={{ ...inputStyle, minHeight: 200, resize: 'vertical', lineHeight: 1.6, fontFamily: 'monospace', fontSize: 12 }}
              placeholder="Full article text. Plain text or simple HTML (p, h2, ul, strong)…"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>

          {/* Cover image (only after save gives us an ID) */}
          {savedId ? (
            <div>
              <label style={labelStyle}>Cover Image</label>
              <CoverUploader
                newsId={savedId}
                currentUrl={coverUrl}
                currentPosition={coverPosition}
                currentZoom={coverZoom}
                onUploaded={(url) => setCoverUrl(url)}
                onPositioned={(pos, zoom) => { setCoverPosition(pos); setCoverZoom(zoom) }}
              />
            </div>
          ) : (
            <div style={{
              background: 'var(--card2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '14px 16px',
              fontSize: 12, color: 'var(--muted)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Upload size={14} />
              Save the article first, then you can upload a cover image.
            </div>
          )}

          {error && (
            <p style={{ margin: 0, color: 'var(--accent)', fontSize: 12, fontWeight: 600 }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px', borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--muted)', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.06em',
            }}
          >
            {saved ? 'CLOSE' : 'CANCEL'}
          </button>
          <button
            onClick={handleSave}
            disabled={pending}
            style={{
              padding: '9px 24px', borderRadius: 6,
              border: 'none',
              background: pending ? 'var(--border)' : 'var(--accent)',
              color: '#fff', fontSize: 12, fontWeight: 800,
              cursor: pending ? 'default' : 'pointer',
              letterSpacing: '0.08em',
              transition: 'background 0.15s',
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending ? 'SAVING…' : saved ? 'SAVED ✓' : isEdit ? 'UPDATE' : 'CREATE'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main admin client ──────────────────────────────────────────────────────
export function NewsAdminClient({ items: initial }: { items: AdminNewsItem[] }) {
  const [items, setItems] = useState(initial)
  const [modalItem, setModalItem] = useState<AdminNewsItem | null | 'new'>()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function reload() {
    // trigger server revalidation by closing the modal and refreshing
    setModalItem(undefined)
    window.location.reload()
  }

  async function handleDelete(id: string) {
    const res = await deleteNewsAction(id)
    if (!res.error) {
      setItems((prev) => prev.filter((i) => i.id !== id))
      setDeleteId(null)
    }
  }

  return (
    <>
      <div style={{ padding: '32px 32px 64px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 28,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ width: 3, height: 22, background: 'var(--accent)', borderRadius: 2 }} />
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#111827', letterSpacing: '-0.02em' }}>
                NEWS MANAGEMENT
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280', marginLeft: 13 }}>
              {items.length} article{items.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <button
            onClick={() => setModalItem('new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 20px', borderRadius: 8,
              background: '#DC2626', border: 'none',
              color: '#fff', fontSize: 12, fontWeight: 800,
              cursor: 'pointer', letterSpacing: '0.08em',
              boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
              transition: 'background 0.15s, box-shadow 0.15s',
            }}
          >
            <Plus size={14} strokeWidth={2.5} />
            NEW ARTICLE
          </button>
        </div>

        {/* Table */}
        {items.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 24px',
            color: '#6b7280', fontSize: 14,
            background: '#fff', borderRadius: 10,
            border: '1px solid #e5e7eb',
          }}>
            No articles yet. Click "NEW ARTICLE" to get started.
          </div>
        ) : (
          <div style={{
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 100px 90px 100px 80px',
              gap: 0,
              background: '#f9fafb',
              borderBottom: '1px solid #e5e7eb',
              padding: '0 16px',
            }}>
              {['IMG', 'TITLE', 'CATEGORY', 'STATUS', 'DATE', 'ACTIONS'].map((h) => (
                <div key={h} style={{
                  padding: '10px 8px',
                  fontSize: 10, fontWeight: 800,
                  color: '#9ca3af', letterSpacing: '0.1em',
                }}>
                  {h}
                </div>
              ))}
            </div>

            {items.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 1fr 100px 90px 100px 80px',
                  gap: 0,
                  padding: '0 16px',
                  borderBottom: idx < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                  alignItems: 'center',
                  background: '#fff',
                  transition: 'background 0.1s',
                }}
              >
                {/* Cover thumbnail */}
                <div style={{ padding: '10px 8px 10px 0' }}>
                  <div style={{
                    width: 44, height: 30,
                    borderRadius: 4, overflow: 'hidden',
                    background: '#f3f4f6',
                    flexShrink: 0,
                  }}>
                    {item.coverUrl ? (
                      <img
                        src={item.coverUrl}
                        alt=""
                        style={{ width: '100%', height: '100%', ...coverImageStyle(item.coverPosition, item.coverZoom) }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <ImageIcon size={12} color="rgba(255,255,255,0.5)" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div style={{ padding: '10px 8px', minWidth: 0 }}>
                  <p style={{
                    margin: 0,
                    fontSize: 13, fontWeight: 700,
                    color: '#111827',
                    letterSpacing: '-0.01em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.title}
                  </p>
                  {item.excerpt && (
                    <p style={{
                      margin: '2px 0 0',
                      fontSize: 11, color: '#9ca3af',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.excerpt}
                    </p>
                  )}
                </div>

                {/* Category */}
                <div style={{ padding: '10px 8px' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                    color: '#DC2626',
                    background: 'rgba(220,38,38,0.08)',
                    padding: '3px 8px', borderRadius: 4,
                  }}>
                    {item.category}
                  </span>
                </div>

                {/* Status */}
                <div style={{ padding: '10px 8px' }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: item.published ? '#16a34a' : '#9ca3af',
                    background: item.published ? 'rgba(22,163,74,0.08)' : 'rgba(156,163,175,0.1)',
                    padding: '3px 8px', borderRadius: 4,
                    display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content',
                  }}>
                    {item.published ? (
                      <><Eye size={10} /> LIVE</>
                    ) : (
                      <><EyeOff size={10} /> DRAFT</>
                    )}
                  </span>
                </div>

                {/* Date */}
                <div style={{ padding: '10px 8px' }}>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    {timeAgo(item.createdAt)}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ padding: '10px 8px', display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setModalItem(item)}
                    title="Edit"
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#6b7280',
                      transition: 'all 0.1s',
                    }}
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => setDeleteId(item.id)}
                    title="Delete"
                    style={{
                      width: 28, height: 28, borderRadius: 6,
                      border: '1px solid #fecaca',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#DC2626',
                      transition: 'all 0.1s',
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(modalItem === 'new' || (modalItem && typeof modalItem === 'object')) && (
        <NewsModal
          item={modalItem === 'new' ? null : modalItem}
          onClose={() => setModalItem(undefined)}
          onSaved={reload}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 12,
            padding: '28px 32px',
            maxWidth: 360, width: '100%',
            boxShadow: '0 20px 48px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800, color: '#111827' }}>
              Delete Article?
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              This action cannot be undone. The article will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  padding: '8px 18px', borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  background: 'transparent', color: '#6b7280',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                style={{
                  padding: '8px 18px', borderRadius: 6,
                  border: 'none',
                  background: '#DC2626', color: '#fff',
                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
