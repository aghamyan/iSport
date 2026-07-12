'use client'

import { useState } from 'react'
import { ShoppingBag, ChevronRight, Flame, Sparkles, Star, Tag, Filter } from 'lucide-react'
import type { ProductRow } from './shopActions'
import { BottomNav } from '@/app/components/BottomNav'
import { ProductModal } from './ProductModal'

const CATEGORIES = ['ALL', 'APPAREL', 'ACCESSORIES', 'COLLECTIBLES', 'EQUIPMENT', 'HOME']

const BADGE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  HOT:     { label: 'HOT',     bg: '#EF4444', color: '#fff' },
  NEW:     { label: 'NEW',     bg: '#3B82F6', color: '#fff' },
  LIMITED: { label: 'LIMITED', bg: '#F59E0B', color: '#000' },
  SALE:    { label: 'SALE',    bg: '#10B981', color: '#fff' },
}

function fmtAMD(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' ֏'
}

function BadgePill({ badge }: { badge: string }) {
  const cfg = BADGE_CONFIG[badge.toUpperCase()] ?? { label: badge, bg: '#6B7280', color: '#fff' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '3px 8px', borderRadius: 4,
      fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

function ProductCard({ product, onSelect }: { product: ProductRow; onSelect: () => void }) {
  const thumb = product.image_urls[0]
  return (
    <div
      onClick={onSelect}
      style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'transform 0.18s, box-shadow 0.18s',
      display: 'flex',
      flexDirection: 'column',
    }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 40px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
        ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
      }}
    >
      {/* Image */}
      <div style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        background: 'var(--card2)',
        overflow: 'hidden',
      }}>
        {thumb ? (
          <img
            src={thumb}
            alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--border)',
          }}>
            <ShoppingBag size={40} strokeWidth={1} />
          </div>
        )}
        {product.badge && (
          <div style={{ position: 'absolute', top: 10, left: 10 }}>
            <BadgePill badge={product.badge} />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {product.tagline && (
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {product.tagline}
          </div>
        )}
        <div style={{
          fontSize: 13, fontWeight: 800, color: 'var(--text)',
          letterSpacing: '-0.01em', lineHeight: 1.25, textTransform: 'uppercase',
        }}>
          {product.title}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            {fmtAMD(product.price)}
          </span>
          <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>
            {product.category}
          </span>
        </div>
      </div>
    </div>
  )
}

function FeaturedBanner({ product, onSelect }: { product: ProductRow; onSelect: () => void }) {
  const thumb = product.image_urls[0]
  return (
    <div
      onClick={onSelect}
      style={{
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      aspectRatio: '16 / 7',
      background: product.image_urls[0] ? 'transparent' : '#111827',
      cursor: 'pointer',
      flex: 1,
      minWidth: 0,
    }}>
      {thumb ? (
        <img
          src={thumb}
          alt={product.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShoppingBag size={60} strokeWidth={1} color="#374151" />
        </div>
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
      }} />

      {/* Text */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {product.tagline && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {product.tagline}
          </div>
        )}
        <div style={{
          fontSize: 'clamp(22px, 4vw, 36px)',
          fontWeight: 900,
          color: '#fff',
          letterSpacing: '-0.02em',
          textTransform: 'uppercase',
          lineHeight: 1.1,
          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
        }}>
          {product.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 20px',
            background: '#fff',
            color: '#111',
            border: 'none',
            borderRadius: 6,
            fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer',
          }}>
            SHOP NOW
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>
            {fmtAMD(product.price)}
          </span>
        </div>
      </div>

      {product.badge && (
        <div style={{ position: 'absolute', top: 14, left: 14 }}>
          <BadgePill badge={product.badge} />
        </div>
      )}
    </div>
  )
}

export function ShopClient({ products, userId }: { products: ProductRow[]; userId: string }) {
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null)

  const featured  = products.filter((p) => p.featured)
  const regular   = products.filter((p) => !p.featured)
  const displayed = activeCategory === 'ALL'
    ? regular
    : regular.filter((p) => p.category === activeCategory)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingTop: 58 }}>
      <style>{`
        @media (max-width: 540px) {
          .shop-featured-row { flex-direction: column !important; }
          .shop-product-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 360px) {
          .shop-product-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--card)',
        borderBottom: '1px solid var(--border)',
        padding: '28px 0 0',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
                Official Merchandise
              </div>
              <h1 style={{
                fontSize: 'clamp(24px, 5vw, 40px)',
                fontWeight: 900,
                color: 'var(--text)',
                letterSpacing: '-0.03em',
                textTransform: 'uppercase',
                lineHeight: 1,
                margin: 0,
              }}>
                FC Store
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShoppingBag size={18} color="var(--muted)" strokeWidth={1.75} />
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                {products.length} items
              </span>
            </div>
          </div>

          {/* Category tabs */}
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderBottom: `2px solid ${activeCategory === cat ? 'var(--accent)' : 'transparent'}`,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: activeCategory === cat ? 'var(--accent)' : 'var(--muted)',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* ── Featured banners ─────────────────────────────────────────── */}
        {featured.length > 0 && (
          <section style={{ marginBottom: 40 }}>
            <div className="shop-featured-row" style={{ display: 'flex', gap: 12 }}>
              {featured.slice(0, 2).map((p) => (
                <FeaturedBanner key={p.id} product={p} onSelect={() => setSelectedProduct(p)} />
              ))}
            </div>
          </section>
        )}

        {/* ── All products grid ─────────────────────────────────────────── */}
        {displayed.length > 0 ? (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{
                fontSize: 18, fontWeight: 900, color: 'var(--text)',
                textTransform: 'uppercase', letterSpacing: '-0.01em', margin: 0,
              }}>
                {activeCategory === 'ALL' ? 'All Products' : activeCategory}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {displayed.length} {displayed.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="shop-product-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}>
              {displayed.map((p) => (
                <ProductCard key={p.id} product={p} onSelect={() => setSelectedProduct(p)} />
              ))}
            </div>
          </section>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '80px 20px', gap: 16,
            color: 'var(--muted)',
          }}>
            <ShoppingBag size={48} strokeWidth={1} />
            <div style={{ fontSize: 14, fontWeight: 600 }}>No products yet</div>
            <div style={{ fontSize: 12 }}>Check back soon for new drops.</div>
          </div>
        )}
      </div>
      <BottomNav userId={userId} />

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  )
}
