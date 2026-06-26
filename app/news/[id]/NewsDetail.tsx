'use client'

import Link from 'next/link'
import { ArrowLeft, Calendar, Tag } from 'lucide-react'
import { CommentsSection, type Comment, type CurrentUser } from './CommentsSection'
import { BottomNav } from '@/app/components/BottomNav'

export interface NewsDetailItem {
  id: string
  title: string
  category: string
  excerpt: string | null
  content: string | null
  coverUrl: string | null
  createdAt: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (d >= 1) return `${d} day${d !== 1 ? 's' : ''} ago`
  if (h >= 1) return `${h} hour${h !== 1 ? 's' : ''} ago`
  return 'Just now'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function NewsDetail({
  item,
  comments,
  currentUser,
}: {
  item: NewsDetailItem
  comments: Comment[]
  currentUser: CurrentUser | null
}) {
  return (
    <>
      <style>{`
        .news-detail-back:hover { color: var(--accent) !important; }
        .news-content p { margin: 0 0 1.2em; color: var(--text2); line-height: 1.75; font-size: 15px; }
        .news-content h2 { margin: 1.5em 0 0.5em; font-size: 20px; font-weight: 800; text-transform: uppercase; color: var(--text); letter-spacing: -0.01em; }
        .news-content h3 { margin: 1.2em 0 0.4em; font-size: 16px; font-weight: 700; color: var(--text); }
        .news-content ul, .news-content ol { margin: 0 0 1.2em; padding-left: 1.5em; color: var(--text2); line-height: 1.75; font-size: 15px; }
        .news-content li { margin-bottom: 0.4em; }
        .news-content strong { color: var(--text); font-weight: 700; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        paddingTop: 'var(--fixed-nav-h)',
      }}>
        {/* Hero image */}
        {item.coverUrl && (
          <div style={{
            width: '100%',
            maxHeight: 480,
            overflow: 'hidden',
            position: 'relative',
          }}>
            <img
              src={item.coverUrl}
              alt={item.title}
              style={{
                width: '100%',
                height: 480,
                objectFit: 'cover',
                display: 'block',
              }}
            />
            {/* Gradient overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.7) 100%)',
            }} />
            {/* Red bar at bottom */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 4, background: 'var(--accent)',
            }} />
          </div>
        )}

        <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 16px 80px' }}>

          {/* Back button */}
          <Link href="/news" style={{ textDecoration: 'none' }}>
            <div
              className="news-detail-back"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 700, color: 'var(--muted)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                marginBottom: 24, cursor: 'pointer',
                transition: 'color 0.15s',
              }}
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              Back to News
            </div>
          </Link>

          {/* Category + date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Tag size={11} color="var(--accent)" />
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
                color: 'var(--accent)', textTransform: 'uppercase',
              }}>
                {item.category}
              </span>
            </div>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={11} color="var(--muted)" />
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {formatDate(item.createdAt)} · {timeAgo(item.createdAt)}
              </span>
            </div>
          </div>

          {/* Red bar + big title */}
          <div style={{ borderLeft: '4px solid var(--accent)', paddingLeft: 14, marginBottom: 20 }}>
            <h1 style={{
              margin: 0,
              fontSize: 32,
              fontWeight: 900,
              color: 'var(--text)',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              textTransform: 'uppercase',
            }}>
              {item.title}
            </h1>
          </div>

          {/* Excerpt (lead paragraph) */}
          {item.excerpt && (
            <p style={{
              margin: '0 0 24px',
              fontSize: 17,
              fontWeight: 500,
              color: 'var(--text2)',
              lineHeight: 1.65,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 24,
            }}>
              {item.excerpt}
            </p>
          )}

          {/* Cover image (if no hero shown above) */}
          {!item.coverUrl && (
            <div style={{
              width: '100%', aspectRatio: '16/9',
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
              borderRadius: 8, marginBottom: 24, overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 72, fontWeight: 900, letterSpacing: '-0.05em' }}>
                NEWS
              </span>
            </div>
          )}

          {/* Article content */}
          {item.content && (
            <div
              className="news-content"
              style={{ lineHeight: 1.75 }}
              dangerouslySetInnerHTML={{ __html: item.content.replace(/\n/g, '<br/>') }}
            />
          )}

          {/* Comments */}
          <CommentsSection
            newsId={item.id}
            initialComments={comments}
            currentUser={currentUser}
          />
        </div>
      </div>
      {currentUser && <BottomNav userId={currentUser.id} />}
    </>
  )
}
