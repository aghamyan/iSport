'use client'

import { useState, useTransition, useRef } from 'react'
import { Plus, Edit2, Trash2, Eye, EyeOff, Upload, X, Image as ImageIcon } from 'lucide-react'
import {
  createNewsAction,
  updateNewsAction,
  deleteNewsAction,
  getSignedNewsPhotoUrl,
  finalizeNewsPhotoUpload,
} from '@/app/news/newsActions'

export interface AdminNewsItem {
  id: string
  title: string
  category: string
  excerpt: string | null
  content: string | null
  coverUrl: string | null
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

// ── Cover image uploader ──────────────────────────────────────────────────
function CoverUploader({
  newsId,
  currentUrl,
  onUploaded,
}: {
  newsId: string
  currentUrl: string | null
  onUploaded: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() as 'jpg' | 'jpeg' | 'png' | 'webp'
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      setError('Use JPG, PNG or WebP')
      return
    }
    setUploading(true)
    setError(null)

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

    const { url, error: finErr } = await finalizeNewsPhotoUpload(newsId, storagePath)
    if (finErr || !url) {
      setError(finErr ?? 'Finalize failed')
    } else {
      setPreview(url)
      onUploaded(url)
    }
    setUploading(false)
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
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(0,0,0,0.7)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.06em',
          }}>
            Click to replace
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
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      {error && <p style={{ color: 'var(--accent)', fontSize: 11, marginTop: 6 }}>{error}</p>}
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
                onUploaded={(url) => setCoverUrl(url)}
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
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
