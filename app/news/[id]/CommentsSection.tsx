'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Send, Trash2, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { addCommentAction, deleteCommentAction } from '@/app/news/commentActions'

export interface Comment {
  id: string
  content: string
  createdAt: string
  parentId: string | null
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
  replies: Comment[]
}

export interface CurrentUser {
  id: string
  name: string
  avatarUrl: string | null
  isAdmin: boolean
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (d >= 1) return `${d}d ago`
  if (h >= 1) return `${h}h ago`
  if (mins >= 1) return `${mins}m ago`
  return 'Just now'
}

function Avatar({ name, avatarUrl, size = 36 }: { name: string; avatarUrl: string | null; size?: number }) {
  const initial = name.charAt(0).toUpperCase()
  if (avatarUrl) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: 'var(--card)', border: '2px solid var(--border)', overflow: 'hidden',
      }}>
        <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      color: '#fff',
      fontSize: size * 0.42,
      fontWeight: 800,
      letterSpacing: '-0.01em',
      border: '2px solid rgba(var(--rgb-accent),0.3)',
    }}>
      {initial}
    </div>
  )
}

function ReplyItem({
  reply,
  newsId,
  currentUserId,
  isAdmin,
  onDelete,
  onReplyClick,
}: {
  reply: Comment
  newsId: string
  currentUserId: string | null
  isAdmin: boolean
  onDelete: (id: string) => void
  onReplyClick: (name: string) => void
}) {
  const [deleting, startDelete] = useTransition()
  const canDelete = currentUserId === reply.user.id || isAdmin

  function handleDelete() {
    startDelete(async () => {
      const res = await deleteCommentAction(reply.id, newsId)
      if (!res.error) onDelete(reply.id)
    })
  }

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '8px 0',
      opacity: deleting ? 0.4 : 1,
      transition: 'opacity 0.15s',
    }}>
      <Avatar name={reply.user.name} avatarUrl={reply.user.avatarUrl} size={28} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: 'var(--card2)',
          borderRadius: 10,
          padding: '7px 12px',
          display: 'inline-block',
          maxWidth: '100%',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            {reply.user.name}
          </div>
          <p style={{
            margin: '2px 0 0',
            fontSize: 12.5,
            color: 'var(--text2)',
            lineHeight: 1.5,
            wordBreak: 'break-word',
          }}>
            {reply.content}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3, paddingLeft: 12 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{timeAgo(reply.createdAt)}</span>
          <button onClick={() => onReplyClick(reply.user.name)} className="comment-reply-link">
            Reply
          </button>
          {canDelete && (
            <button onClick={handleDelete} disabled={deleting} className="comment-reply-link">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  newsId,
  currentUser,
  isAdmin,
  onDelete,
  onReplyStart,
  onReplyConfirm,
  onReplyRollback,
  onDeleteReply,
}: {
  comment: Comment
  newsId: string
  currentUser: CurrentUser | null
  isAdmin: boolean
  onDelete: (id: string) => void
  onReplyStart: (topLevelId: string, reply: Comment) => void
  onReplyConfirm: (topLevelId: string, tempId: string, real: { id: string; createdAt: string }) => void
  onReplyRollback: (topLevelId: string, tempId: string) => void
  onDeleteReply: (topLevelId: string, replyId: string) => void
}) {
  const [deleting, startDelete] = useTransition()
  const [showComposer, setShowComposer] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyErr, setReplyErr] = useState<string | null>(null)
  const [posting, startPosting] = useTransition()
  const [showReplies, setShowReplies] = useState(comment.replies.length > 0 && comment.replies.length <= 2)
  const replyRef = useRef<HTMLTextAreaElement>(null)

  const currentUserId = currentUser?.id ?? null
  const canDelete = currentUserId === comment.user.id || isAdmin

  function handleDelete() {
    startDelete(async () => {
      const res = await deleteCommentAction(comment.id, newsId)
      if (!res.error) onDelete(comment.id)
    })
  }

  function openComposer(mentionName?: string) {
    if (!currentUser) return
    setShowComposer(true)
    setShowReplies(true)
    if (mentionName) setReplyText(`@${mentionName} `)
    requestAnimationFrame(() => {
      const el = replyRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  function submitReply() {
    if (!replyText.trim() || posting || !currentUser) return
    setReplyErr(null)

    const tempId = `opt-${Date.now()}`
    const optimistic: Comment = {
      id: tempId,
      content: replyText.trim(),
      createdAt: new Date().toISOString(),
      parentId: comment.id,
      user: { id: currentUser.id, name: currentUser.name, avatarUrl: currentUser.avatarUrl },
      replies: [],
    }
    onReplyStart(comment.id, optimistic)
    const submitted = replyText.trim()
    setReplyText('')
    setShowComposer(false)

    startPosting(async () => {
      const res = await addCommentAction(newsId, submitted, comment.id)
      if (res.error) {
        setReplyErr(res.error)
        onReplyRollback(comment.id, tempId)
      } else if (res.comment) {
        onReplyConfirm(comment.id, tempId, res.comment)
      }
    })
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submitReply()
    }
  }

  return (
    <div style={{
      padding: '14px 0',
      borderBottom: '1px solid var(--border)',
      opacity: deleting ? 0.4 : 1,
      transition: 'opacity 0.15s',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Avatar name={comment.user.name} avatarUrl={comment.user.avatarUrl} size={36} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 13, fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
            }}>
              {comment.user.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {timeAgo(comment.createdAt)}
            </span>
          </div>
          <p style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--text2)',
            lineHeight: 1.6,
            wordBreak: 'break-word',
          }}>
            {comment.content}
          </p>

          <div style={{ marginTop: 6 }}>
            <button onClick={() => openComposer()} className="comment-reply-link">
              Reply
            </button>
          </div>
        </div>

        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Delete comment"
            style={{
              flexShrink: 0,
              width: 28, height: 28,
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              cursor: deleting ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--muted)',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            className="comment-delete-btn"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Replies + reply composer, indented under the parent comment */}
      {(comment.replies.length > 0 || showComposer) && (
        <div style={{ marginLeft: 48, marginTop: 4 }}>
          {comment.replies.length > 0 && (
            <button
              onClick={() => setShowReplies((v) => !v)}
              className="comments-toggle"
              style={{ fontSize: 11, marginTop: 4 }}
            >
              {showReplies ? (
                <><ChevronUp size={12} /> Hide replies</>
              ) : (
                <><ChevronDown size={12} /> View {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</>
              )}
            </button>
          )}

          {showReplies && comment.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              newsId={newsId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onDelete={(id) => onDeleteReply(comment.id, id)}
              onReplyClick={(name) => openComposer(name)}
            />
          ))}

          {showComposer && currentUser && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8 }}>
              <Avatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <textarea
                  ref={replyRef}
                  value={replyText}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_CHARS) setReplyText(e.target.value)
                  }}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={`Reply to ${comment.user.name}…`}
                  rows={2}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1px solid ${replyText.length > 0 ? 'var(--accent)' : 'var(--border)'}`,
                    background: 'var(--card2)',
                    color: 'var(--text)',
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                    {replyErr ?? ''}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setShowComposer(false); setReplyText(''); setReplyErr(null) }}
                      className="comment-reply-link"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitReply}
                      disabled={posting || !replyText.trim()}
                      className="comment-submit-btn"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: replyText.trim() ? 'var(--accent)' : 'var(--border)',
                        color: replyText.trim() ? '#fff' : 'var(--muted)',
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                        cursor: posting || !replyText.trim() ? 'default' : 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                        opacity: posting ? 0.6 : 1,
                      }}
                    >
                      <Send size={10} strokeWidth={2} />
                      {posting ? 'POSTING…' : 'REPLY'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const MAX_CHARS = 500
const INITIAL_VISIBLE = 5

export function CommentsSection({
  newsId,
  initialComments,
  currentUser,
}: {
  newsId: string
  initialComments: Comment[]
  currentUser: CurrentUser | null
}) {
  const [comments, setComments] = useState(initialComments)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [showAll, setShowAll] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const remaining = MAX_CHARS - text.length
  const visible = showAll ? comments : comments.slice(0, INITIAL_VISIBLE)
  const hasMore = comments.length > INITIAL_VISIBLE
  const totalCount = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0)

  function handleSubmit() {
    if (!text.trim() || pending) return
    setError(null)

    // Optimistic update
    const optimistic: Comment = {
      id: `opt-${Date.now()}`,
      content: text.trim(),
      createdAt: new Date().toISOString(),
      parentId: null,
      user: {
        id: currentUser!.id,
        name: currentUser!.name,
        avatarUrl: currentUser!.avatarUrl,
      },
      replies: [],
    }
    setComments((prev) => [optimistic, ...prev])
    const submitted = text.trim()
    setText('')

    startTransition(async () => {
      const res = await addCommentAction(newsId, submitted)
      if (res.error) {
        setError(res.error)
        // Roll back optimistic
        setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
        setText(submitted)
      } else if (res.comment) {
        // Replace optimistic with real id
        setComments((prev) =>
          prev.map((c) =>
            c.id === optimistic.id
              ? { ...c, id: res.comment!.id, createdAt: res.comment!.createdAt }
              : c
          )
        )
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleReplyStart(topLevelId: string, reply: Comment) {
    setComments((prev) =>
      prev.map((c) => (c.id === topLevelId ? { ...c, replies: [...c.replies, reply] } : c))
    )
  }

  function handleReplyConfirm(topLevelId: string, tempId: string, real: { id: string; createdAt: string }) {
    setComments((prev) =>
      prev.map((c) =>
        c.id === topLevelId
          ? { ...c, replies: c.replies.map((r) => (r.id === tempId ? { ...r, id: real.id, createdAt: real.createdAt } : r)) }
          : c
      )
    )
  }

  function handleReplyRollback(topLevelId: string, tempId: string) {
    setComments((prev) =>
      prev.map((c) => (c.id === topLevelId ? { ...c, replies: c.replies.filter((r) => r.id !== tempId) } : c))
    )
  }

  function handleDeleteReply(topLevelId: string, replyId: string) {
    setComments((prev) =>
      prev.map((c) => (c.id === topLevelId ? { ...c, replies: c.replies.filter((r) => r.id !== replyId) } : c))
    )
  }

  return (
    <>
      <style>{`
        .comment-delete-btn:hover { color: var(--accent) !important; border-color: rgba(var(--rgb-accent),0.4) !important; }
        .comment-submit-btn:hover:not(:disabled) { background: var(--accent2) !important; }
        .comments-toggle:hover { color: var(--accent) !important; }
        .comment-reply-link {
          background: transparent; border: none; padding: 0; cursor: pointer;
          font-size: 11px; font-weight: 800; letter-spacing: 0.02em;
          color: var(--muted); transition: color 0.15s;
        }
        .comment-reply-link:hover { color: var(--accent); }
        .comments-toggle {
          display: flex; align-items: center; gap: 6px;
          background: transparent; border: none;
          cursor: pointer;
          font-weight: 700;
          color: var(--muted);
          letter-spacing: 0.06em;
          transition: color 0.15s;
        }
      `}</style>

      <section style={{
        marginTop: 40,
        paddingTop: 32,
        borderTop: '2px solid var(--border)',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 3, height: 22, background: 'var(--accent)', borderRadius: 2 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{
              margin: 0,
              fontSize: 16, fontWeight: 900,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
              textTransform: 'uppercase',
              fontFamily: 'var(--font-news-heading)',
            }}>
              COMMUNITY
            </h2>
            {totalCount > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 800,
                color: 'var(--accent)',
                background: 'rgba(var(--rgb-accent),0.1)',
                padding: '2px 8px', borderRadius: 4,
              }}>
                {totalCount}
              </span>
            )}
          </div>
        </div>

        {/* Comment form */}
        {currentUser ? (
          <div style={{
            display: 'flex', gap: 12, alignItems: 'flex-start',
            marginBottom: 28,
            background: 'var(--card)',
            borderRadius: 10,
            padding: 16,
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border)',
          }}>
            <Avatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} size={36} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) setText(e.target.value)
                }}
                onKeyDown={handleKeyDown}
                placeholder="Share your thoughts…"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${text.length > 0 ? 'var(--accent)' : 'var(--border)'}`,
                  background: 'var(--card2)',
                  color: 'var(--text)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                  fontFamily: 'inherit',
                }}
              />

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 10, color: remaining < 50 ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: remaining < 50 ? 700 : 400,
                  }}>
                    {remaining} chars left
                  </span>
                  {error && (
                    <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                      {error}
                    </span>
                  )}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={pending || !text.trim()}
                  className="comment-submit-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 16px',
                    borderRadius: 6,
                    border: 'none',
                    background: text.trim() ? 'var(--accent)' : 'var(--border)',
                    color: text.trim() ? '#fff' : 'var(--muted)',
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                    cursor: pending || !text.trim() ? 'default' : 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                    opacity: pending ? 0.6 : 1,
                  }}
                >
                  <Send size={12} strokeWidth={2} />
                  {pending ? 'POSTING…' : 'POST'}
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                Ctrl+Enter to post
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            padding: '16px 20px',
            background: 'var(--card)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <MessageCircle size={16} color="var(--muted)" />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              Sign in to join the conversation.
            </span>
          </div>
        )}

        {/* Comments list */}
        {comments.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 0',
            color: 'var(--muted)', fontSize: 13,
          }}>
            No comments yet. Be the first to share your thoughts.
          </div>
        ) : (
          <div>
            {visible.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                newsId={newsId}
                currentUser={currentUser}
                isAdmin={currentUser?.isAdmin ?? false}
                onDelete={(id) => setComments((prev) => prev.filter((c) => c.id !== id))}
                onReplyStart={handleReplyStart}
                onReplyConfirm={handleReplyConfirm}
                onReplyRollback={handleReplyRollback}
                onDeleteReply={handleDeleteReply}
              />
            ))}

            {hasMore && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="comments-toggle"
                style={{
                  marginTop: 12,
                  fontSize: 12,
                }}
              >
                {showAll ? (
                  <><ChevronUp size={14} /> SHOW LESS</>
                ) : (
                  <><ChevronDown size={14} /> SHOW {comments.length - INITIAL_VISIBLE} MORE</>
                )}
              </button>
            )}
          </div>
        )}
      </section>
    </>
  )
}
