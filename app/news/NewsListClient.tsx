'use client'

import Link from 'next/link'
import { Calendar, Tag } from 'lucide-react'
import { BottomNav } from '@/app/components/BottomNav'

export interface NewsItem {
  id: string
  title: string
  category: string
  excerpt: string | null
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

function FeaturedCard({ item }: { item: NewsItem }) {
  return (
    <Link href={`/news/${item.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article style={{
        background: 'var(--card)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}
        className="news-featured-card"
      >
        {/* Cover image */}
        <div style={{
          width: '100%',
          aspectRatio: '16/9',
          background: 'var(--card2)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt={item.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 64, fontWeight: 900, letterSpacing: '-0.05em' }}>
                NEWS
              </span>
            </div>
          )}
          {/* Category overlay badge */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 3,
            background: 'var(--accent)',
          }} />
        </div>

        {/* Text */}
        <div style={{ padding: '18px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
              color: 'var(--accent)', textTransform: 'uppercase',
            }}>
              {item.category}
            </span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--muted)' }} />
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
              {timeAgo(item.createdAt)}
            </span>
          </div>

          {/* Red bar + Title */}
          <div style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 10, marginBottom: 10 }}>
            <h2 style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 900,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              textTransform: 'uppercase',
            }}>
              {item.title}
            </h2>
          </div>

          {item.excerpt && (
            <p style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--muted)',
              lineHeight: 1.6,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}>
              {item.excerpt}
            </p>
          )}
        </div>
      </article>
    </Link>
  )
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <Link href={`/news/${item.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <article style={{
        background: 'var(--card)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.2s',
        display: 'flex',
        flexDirection: 'column',
      }}
        className="news-card"
      >
        {/* Cover */}
        <div style={{ width: '100%', aspectRatio: '16/9', background: 'var(--card2)', overflow: 'hidden', position: 'relative' }}>
          {item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt={item.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, #1a0a0a 0%, var(--card2) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: 'rgba(220,38,38,0.25)', fontSize: 28, fontWeight: 900, letterSpacing: '0.1em' }}>
                NEWS
              </span>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--accent)' }} />
        </div>

        {/* Text */}
        <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
              color: 'var(--accent)', textTransform: 'uppercase',
            }}>
              {item.category}
            </span>
            <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--muted)' }} />
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{timeAgo(item.createdAt)}</span>
          </div>

          <h3 style={{
            margin: '0 0 8px',
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--text)',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            flex: 1,
          }}>
            {item.title}
          </h3>

          {item.excerpt && (
            <p style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--muted)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            } as React.CSSProperties}>
              {item.excerpt}
            </p>
          )}
        </div>
      </article>
    </Link>
  )
}

export function NewsListClient({ items, userId }: { items: NewsItem[]; userId: string }) {
  const featured = items[0]
  const rest = items.slice(1)

  return (
    <>
      <style>{`
        .news-featured-card:hover { box-shadow: var(--shadow-card-hover) !important; transform: translateY(-2px); }
        .news-card:hover { box-shadow: var(--shadow-card-hover) !important; transform: translateY(-2px); }
        @media (max-width: 768px) {
          .news-grid { grid-template-columns: 1fr !important; }
          .news-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        paddingTop: 'var(--fixed-nav-h)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px 64px' }}>

          {/* Page header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <div style={{ width: 36, height: 3, background: 'var(--accent)' }} />
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.15em',
                color: 'var(--accent)', textTransform: 'uppercase',
              }}>
                iSport FC26
              </span>
            </div>
            <h1 style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 900,
              color: 'var(--text)',
              letterSpacing: '-0.03em',
              textTransform: 'uppercase',
            }}>
              FEATURED CONTENT
            </h1>
          </div>

          {items.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '80px 24px',
              color: 'var(--muted)', fontSize: 15,
            }}>
              No news published yet. Check back soon.
            </div>
          ) : (
            <div className="news-layout" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 340px',
              gap: 24,
              alignItems: 'start',
            }}>
              {/* Left: featured + grid */}
              <div>
                {featured && <FeaturedCard item={featured} />}

                {rest.length > 0 && (
                  <>
                    {/* Latest news header */}
                    <div style={{ margin: '28px 0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 3, height: 20, background: 'var(--accent)' }} />
                      <span style={{
                        fontSize: 13, fontWeight: 800, color: 'var(--text)',
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                      }}>
                        Latest News
                      </span>
                    </div>

                    <div className="news-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 16,
                    }}>
                      {rest.map((item) => (
                        <NewsCard key={item.id} item={item} />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Right: category sidebar */}
              <div>
                <div style={{
                  background: 'var(--card)',
                  borderRadius: 10,
                  padding: '20px',
                  boxShadow: 'var(--shadow-card)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <div style={{ width: 24, height: 2, background: 'var(--accent)' }} />
                    <span style={{
                      fontSize: 11, fontWeight: 800, color: 'var(--text)',
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                    }}>
                      Browse by Category
                    </span>
                  </div>

                  {Array.from(new Set(items.map((i) => i.category))).map((cat) => {
                    const count = items.filter((i) => i.category === cat).length
                    return (
                      <div key={cat} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--border)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Tag size={12} color="var(--accent)" />
                          <span style={{
                            fontSize: 12, fontWeight: 700,
                            color: 'var(--text)', letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                          }}>
                            {cat}
                          </span>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: 'var(--accent)',
                          background: 'rgba(var(--rgb-accent),0.08)',
                          padding: '2px 8px', borderRadius: 4,
                        }}>
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Recent articles sidebar list */}
                {items.length > 1 && (
                  <div style={{
                    background: 'var(--card)',
                    borderRadius: 10,
                    padding: '20px',
                    boxShadow: 'var(--shadow-card)',
                    marginTop: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <div style={{ width: 24, height: 2, background: 'var(--accent)' }} />
                      <span style={{
                        fontSize: 11, fontWeight: 800, color: 'var(--text)',
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                      }}>
                        Recent
                      </span>
                    </div>

                    {items.slice(0, 5).map((item, idx) => (
                      <Link
                        key={item.id}
                        href={`/news/${item.id}`}
                        style={{ textDecoration: 'none', display: 'block' }}
                      >
                        <div style={{
                          display: 'flex', gap: 12, alignItems: 'flex-start',
                          padding: '10px 0',
                          borderBottom: idx < 4 ? '1px solid var(--border)' : 'none',
                          cursor: 'pointer',
                        }}
                          className="news-recent-item"
                        >
                          <div style={{
                            flexShrink: 0, width: 64, height: 44,
                            borderRadius: 4, overflow: 'hidden',
                            background: 'var(--card2)',
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
                                background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
                              }} />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              margin: '0 0 3px',
                              fontSize: 11, fontWeight: 800,
                              color: 'var(--text)', lineHeight: 1.3,
                              textTransform: 'uppercase',
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            } as React.CSSProperties}>
                              {item.title}
                            </p>
                            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                              {timeAgo(item.createdAt)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <BottomNav userId={userId} />
    </>
  )
}
