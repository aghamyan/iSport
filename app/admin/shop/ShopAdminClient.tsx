'use client'

import { useState, useTransition, useRef } from 'react'
import {
  Plus, Edit2, Trash2, Upload, X, Image as ImageIcon,
  Star, Tag, Eye, EyeOff, ShoppingBag, Package,
} from 'lucide-react'
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  getSignedShopPhotoUrlAction,
  finalizeShopPhotoUploadAction,
  removeShopPhotoAction,
} from '@/app/shop/shopActions'
import type { ProductRow } from '@/app/shop/shopActions'

const CATEGORIES = ['APPAREL', 'ACCESSORIES', 'COLLECTIBLES', 'EQUIPMENT', 'HOME']
const BADGES     = ['', 'HOT', 'NEW', 'LIMITED', 'SALE']

const BADGE_COLORS: Record<string, string> = {
  HOT: '#EF4444', NEW: '#3B82F6', LIMITED: '#F59E0B', SALE: '#10B981',
}

function fmtAMD(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ֏'
}

// ── Image uploader sub-component ──────────────────────────────────────────

function PhotoUploader({
  productId,
  currentUrls,
  onUploaded,
  onRemoved,
}: {
  productId: string
  currentUrls: string[]
  onUploaded: (url: string) => void
  onRemoved: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [removing, setRemoving]   = useState<string | null>(null)
  const inputRef                  = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() as 'jpg' | 'jpeg' | 'png' | 'webp'
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      setError('Use JPG, PNG or WebP')
      return
    }
    setUploading(true)
    setError(null)

    const { signedUrl, storagePath, error: urlErr } = await getSignedShopPhotoUrlAction(productId, ext)
    if (urlErr || !signedUrl || !storagePath) {
      setError(urlErr ?? 'Failed to get upload URL')
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

    const { url, error: finErr } = await finalizeShopPhotoUploadAction(productId, storagePath)
    if (finErr || !url) {
      setError(finErr ?? 'Finalize failed')
    } else {
      onUploaded(url)
    }
    setUploading(false)
  }

  async function handleRemove(url: string) {
    setRemoving(url)
    await removeShopPhotoAction(productId, url)
    onRemoved(url)
    setRemoving(null)
  }

  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
        Photos
      </label>

      {/* Existing photos */}
      {currentUrls.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {currentUrls.map((url) => (
            <div key={url} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1px solid #374151' }}>
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                onClick={() => handleRemove(url)}
                disabled={removing === url}
                style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff',
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: `2px dashed #374151`,
          borderRadius: 8,
          padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: uploading ? 'default' : 'pointer',
          transition: 'border-color 0.15s',
          background: '#1f2937',
          opacity: uploading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => { if (!uploading) (e.currentTarget as HTMLDivElement).style.borderColor = '#EF4444' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#374151' }}
      >
        <Upload size={18} color="#6b7280" />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db' }}>
            {uploading ? 'Uploading...' : 'Click to upload photo'}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>JPG, PNG, WebP</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {error && <div style={{ color: '#EF4444', fontSize: 11, marginTop: 6 }}>{error}</div>}
    </div>
  )
}

// ── Product form ──────────────────────────────────────────────────────────

const EMPTY: {
  title: string; tagline: string; description: string
  price: string; category: string; badge: string
  featured: boolean; active: boolean
} = {
  title: '', tagline: '', description: '',
  price: '', category: 'APPAREL', badge: '',
  featured: false, active: true,
}

type FormState = typeof EMPTY

function ProductForm({
  initial,
  onSave,
  onCancel,
  productId,
  imageUrls,
}: {
  initial: FormState
  onSave: (f: FormState) => Promise<void>
  onCancel: () => void
  productId: string | null
  imageUrls: string[]
}) {
  const [form, setForm]               = useState(initial)
  const [pending, startTransition]    = useTransition()
  const [error, setError]             = useState<string | null>(null)
  const [localImgs, setLocalImgs]     = useState<string[]>(imageUrls)

  function field(key: keyof FormState) {
    return {
      value: form[key] as string,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    }
  }

  const INPUT_STYLE: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 7,
    border: '1px solid #374151', background: '#111827',
    color: '#f9fafb', fontSize: 13, outline: 'none',
    boxSizing: 'border-box',
  }
  const LABEL_STYLE: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#9ca3af',
    letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 5,
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!form.title.trim()) { setError('Title is required'); return }
        const price = parseInt(form.price, 10)
        if (isNaN(price) || price < 0) { setError('Enter a valid price'); return }
        setError(null)
        startTransition(() => onSave({ ...form, price: String(price) }))
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {/* Title */}
      <div>
        <label style={LABEL_STYLE}>Title *</label>
        <input {...field('title')} placeholder="CHAMPIONSHIP HOODIE" required style={INPUT_STYLE} />
      </div>

      {/* Tagline */}
      <div>
        <label style={LABEL_STYLE}>Tagline</label>
        <input {...field('tagline')} placeholder="LIGHTWEIGHT CHAMPION" style={INPUT_STYLE} />
      </div>

      {/* Description */}
      <div>
        <label style={LABEL_STYLE}>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Product description..."
          rows={3}
          style={{ ...INPUT_STYLE, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      {/* Price + Category row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={LABEL_STYLE}>Price (AMD) *</label>
          <input
            type="number"
            min="0"
            {...field('price')}
            placeholder="15000"
            required
            style={INPUT_STYLE}
          />
        </div>
        <div>
          <label style={LABEL_STYLE}>Category</label>
          <select {...field('category')} style={INPUT_STYLE}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Badge */}
      <div>
        <label style={LABEL_STYLE}>Badge</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {BADGES.map((b) => (
            <button
              key={b || 'none'}
              type="button"
              onClick={() => setForm((f) => ({ ...f, badge: b }))}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid',
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em',
                borderColor: form.badge === b
                  ? (b ? BADGE_COLORS[b] ?? '#EF4444' : '#6b7280')
                  : '#374151',
                background: form.badge === b
                  ? (b ? `${BADGE_COLORS[b] ?? '#EF4444'}22` : '#1f2937')
                  : 'transparent',
                color: form.badge === b
                  ? (b ? BADGE_COLORS[b] ?? '#EF4444' : '#9ca3af')
                  : '#6b7280',
              }}
            >
              {b || 'None'}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <div
            onClick={() => setForm((f) => ({ ...f, featured: !f.featured }))}
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: form.featured ? '#EF4444' : '#374151',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: form.featured ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ fontSize: 12, color: '#d1d5db', fontWeight: 600 }}>Featured</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <div
            onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
            style={{
              width: 36, height: 20, borderRadius: 10,
              background: form.active ? '#10B981' : '#374151',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
              flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 2, left: form.active ? 18 : 2,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ fontSize: 12, color: '#d1d5db', fontWeight: 600 }}>Active (visible)</span>
        </label>
      </div>

      {/* Photo uploader — only shown after product is saved */}
      {productId && (
        <PhotoUploader
          productId={productId}
          currentUrls={localImgs}
          onUploaded={(url) => setLocalImgs((prev) => [...prev, url])}
          onRemoved={(url) => setLocalImgs((prev) => prev.filter((u) => u !== url))}
        />
      )}

      {!productId && (
        <div style={{
          background: '#1f2937', borderRadius: 8, padding: '10px 14px',
          fontSize: 12, color: '#9ca3af',
          border: '1px solid #374151',
        }}>
          Save the product first, then upload photos.
        </div>
      )}

      {error && <div style={{ color: '#EF4444', fontSize: 12, fontWeight: 600 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{
          padding: '9px 18px', borderRadius: 7, border: '1px solid #374151',
          background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 13, fontWeight: 600,
        }}>
          Cancel
        </button>
        <button type="submit" disabled={pending} style={{
          padding: '9px 22px', borderRadius: 7, border: 'none',
          background: pending ? '#374151' : '#EF4444',
          color: '#fff', cursor: pending ? 'default' : 'pointer',
          fontSize: 13, fontWeight: 700,
          transition: 'background 0.15s',
        }}>
          {pending ? 'Saving...' : (productId ? 'Save Changes' : 'Create Product')}
        </button>
      </div>
    </form>
  )
}

// ── Main admin component ──────────────────────────────────────────────────

export function ShopAdminClient({ products: initial }: { products: ProductRow[] }) {
  const [products, setProducts]       = useState<ProductRow[]>(initial)
  const [modal, setModal]             = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing]         = useState<ProductRow | null>(null)
  const [deletingId, setDeletingId]   = useState<string | null>(null)
  const [, startTransition]           = useTransition()

  function openCreate() { setEditing(null); setModal('create') }
  function openEdit(p: ProductRow) { setEditing(p); setModal('edit') }
  function closeModal() { setModal(null); setEditing(null) }

  async function handleCreate(form: FormState) {
    const price = parseInt(form.price as unknown as string, 10)
    const result = await createProductAction({
      title:       form.title,
      tagline:     form.tagline,
      description: form.description,
      price,
      category:    form.category,
      badge:       form.badge,
      featured:    form.featured,
    })
    if (result.error) { alert(result.error); return }
    const newRow: ProductRow = {
      id:          result.id!,
      title:       form.title,
      tagline:     form.tagline || null,
      description: form.description || null,
      price,
      image_urls:  [],
      category:    form.category,
      badge:       form.badge || null,
      featured:    form.featured,
      active:      form.active,
      created_at:  new Date().toISOString(),
    }
    setProducts((prev) => [newRow, ...prev])
    // Switch to edit mode so photos can be uploaded
    setEditing(newRow)
    setModal('edit')
  }

  async function handleUpdate(form: FormState) {
    if (!editing) return
    const price = parseInt(form.price as unknown as string, 10)
    const result = await updateProductAction(editing.id, {
      title:       form.title,
      tagline:     form.tagline,
      description: form.description,
      price,
      category:    form.category,
      badge:       form.badge,
      featured:    form.featured,
      active:      form.active,
    })
    if (result.error) { alert(result.error); return }
    setProducts((prev) =>
      prev.map((p) => p.id === editing.id
        ? { ...p, title: form.title, tagline: form.tagline || null, description: form.description || null, price, category: form.category, badge: form.badge || null, featured: form.featured, active: form.active }
        : p
      )
    )
    closeModal()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product? This cannot be undone.')) return
    setDeletingId(id)
    const result = await deleteProductAction(id)
    if (result.error) { alert(result.error); setDeletingId(null); return }
    setProducts((prev) => prev.filter((p) => p.id !== id))
    setDeletingId(null)
  }

  const CARD: React.CSSProperties = {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: 10,
    overflow: 'hidden',
    display: 'flex',
    gap: 0,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f9fafb', letterSpacing: '-0.02em' }}>
            Shop Products
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {products.length} product{products.length !== 1 ? 's' : ''} · Manage your store catalogue
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '10px 18px', borderRadius: 8, border: 'none',
            background: '#EF4444', color: '#fff', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, transition: 'background 0.15s',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          New Product
        </button>
      </div>

      {/* Products grid */}
      {products.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '80px 20px', gap: 14,
          background: '#111827', borderRadius: 12, border: '1px solid #1f2937',
        }}>
          <ShoppingBag size={48} strokeWidth={1} color="#374151" />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#6b7280' }}>No products yet</div>
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: '#EF4444', color: '#fff', cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
          }}>
            <Plus size={14} />
            Add First Product
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {products.map((p) => {
            const thumb = p.image_urls[0]
            return (
              <div key={p.id} style={CARD}>
                {/* Thumbnail */}
                <div style={{
                  width: 90, height: 90, flexShrink: 0,
                  background: '#1f2937', overflow: 'hidden',
                }}>
                  {thumb
                    ? <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ImageIcon size={24} color="#374151" strokeWidth={1} />
                      </div>
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 800, color: '#f9fafb',
                        textTransform: 'uppercase', letterSpacing: '-0.01em',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {p.title}
                      </span>
                      {p.featured && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: '#F59E0B', letterSpacing: '0.1em' }}>
                          ★ FEATURED
                        </span>
                      )}
                      {p.badge && (
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 3,
                          background: `${BADGE_COLORS[p.badge] ?? '#6b7280'}22`,
                          color: BADGE_COLORS[p.badge] ?? '#9ca3af',
                          border: `1px solid ${BADGE_COLORS[p.badge] ?? '#6b7280'}44`,
                          letterSpacing: '0.08em',
                        }}>
                          {p.badge}
                        </span>
                      )}
                    </div>
                    {p.tagline && (
                      <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 2 }}>
                        {p.tagline}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#f9fafb' }}>{fmtAMD(p.price)}</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{p.category}</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{p.image_urls.length} photo{p.image_urls.length !== 1 ? 's' : ''}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                        background: p.active ? '#10B98122' : '#6b728022',
                        color: p.active ? '#10B981' : '#6b7280',
                        border: `1px solid ${p.active ? '#10B98144' : '#6b728044'}`,
                        letterSpacing: '0.08em',
                      }}>
                        {p.active ? 'ACTIVE' : 'HIDDEN'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => openEdit(p)}
                      style={{
                        width: 34, height: 34, borderRadius: 7,
                        border: '1px solid #374151', background: 'transparent',
                        cursor: 'pointer', color: '#9ca3af',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      style={{
                        width: 34, height: 34, borderRadius: 7,
                        border: '1px solid #374151', background: 'transparent',
                        cursor: deletingId === p.id ? 'default' : 'pointer',
                        color: deletingId === p.id ? '#374151' : '#EF4444',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '40px 16px',
          overflowY: 'auto',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{
            background: '#1a2333',
            border: '1px solid #374151',
            borderRadius: 14,
            width: '100%', maxWidth: 560,
            padding: '28px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#f9fafb', letterSpacing: '-0.02em' }}>
                {modal === 'create' ? 'New Product' : 'Edit Product'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>

            <ProductForm
              initial={editing ? {
                title:       editing.title,
                tagline:     editing.tagline     ?? '',
                description: editing.description ?? '',
                price:       String(editing.price),
                category:    editing.category,
                badge:       editing.badge        ?? '',
                featured:    editing.featured,
                active:      editing.active,
              } : { ...EMPTY }}
              onSave={modal === 'create' ? handleCreate : handleUpdate}
              onCancel={closeModal}
              productId={editing?.id ?? null}
              imageUrls={editing?.image_urls ?? []}
            />
          </div>
        </div>
      )}
    </div>
  )
}
