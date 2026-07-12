'use client'

import { useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import type { ProductRow } from './shopActions'

const MODAL_ANIMS = `
  @keyframes productOverlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes productPanelIn {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`

const BADGE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  HOT:     { label: 'HOT',     bg: '#EF4444', color: '#fff' },
  NEW:     { label: 'NEW',     bg: '#3B82F6', color: '#fff' },
  LIMITED: { label: 'LIMITED', bg: '#F59E0B', color: '#000' },
  SALE:    { label: 'SALE',    bg: '#10B981', color: '#fff' },
}

function fmtAMD(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ֏'
}

export function ProductModal({ product, onClose }: { product: ProductRow; onClose: () => void }) {
  const [activeImage, setActiveImage] = useState(0)
  const images = product.image_urls
  const badgeCfg = product.badge
    ? BADGE_CONFIG[product.badge.toUpperCase()] ?? { label: product.badge, bg: '#6B7280', color: '#fff' }
    : null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MODAL_ANIMS }} />

      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 200,
          animation: 'productOverlayIn 0.2s ease both',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '20px 12px 40px',
            minHeight: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: 'var(--card)',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
              animation: 'productPanelIn 0.3s cubic-bezier(0.22,1,0.36,1) both',
            }}
          >
            {/* Image */}
            <div style={{ position: 'relative', aspectRatio: '1 / 1', background: 'var(--card2)' }}>
              {images.length > 0 ? (
                <img
                  src={images[activeImage]}
                  alt={product.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--border)',
                }}>
                  <ShoppingBag size={64} strokeWidth={1} />
                </div>
              )}

              {badgeCfg && (
                <div style={{ position: 'absolute', top: 14, left: 14 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '4px 10px', borderRadius: 4,
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
                    background: badgeCfg.bg, color: badgeCfg.color,
                  }}>
                    {badgeCfg.label}
                  </span>
                </div>
              )}

              <button
                onClick={onClose}
                style={{
                  position: 'absolute', top: 14, right: 14,
                  background: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '6px 12px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>

              {images.length > 1 && (
                <div style={{
                  position: 'absolute', bottom: 12, left: 0, right: 0,
                  display: 'flex', justifyContent: 'center', gap: 6,
                }}>
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i)}
                      style={{
                        width: 8, height: 8, borderRadius: '50%',
                        border: 'none', cursor: 'pointer', padding: 0,
                        background: i === activeImage ? '#fff' : 'rgba(255,255,255,0.45)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ padding: '20px 22px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {product.tagline && (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {product.tagline}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <h2 style={{
                  fontSize: 22, fontWeight: 900, color: 'var(--text)',
                  letterSpacing: '-0.01em', lineHeight: 1.2, textTransform: 'uppercase', margin: 0,
                }}>
                  {product.title}
                </h2>
                <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                  {fmtAMD(product.price)}
                </span>
              </div>

              <span style={{
                fontSize: 11, color: 'var(--muted)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {product.category}
              </span>

              {product.description && (
                <p style={{
                  fontSize: 14, color: 'var(--text)', lineHeight: 1.6,
                  marginTop: 8, whiteSpace: 'pre-wrap',
                }}>
                  {product.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
