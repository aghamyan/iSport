-- ============================================================
-- News comment replies patch
-- Run in Supabase SQL editor AFTER schema_news_comments_fkey_patch.sql
--
-- Adds one-level threaded replies to news_comments (Facebook-style
-- discussion): a reply's parent_id points at the top-level comment
-- it belongs to. Replying to a reply still attaches to that same
-- top-level parent_id (flattened), which app/news/[id]/CommentsSection.tsx
-- and app/news/commentActions.ts rely on.
-- ============================================================

alter table news_comments
  add column if not exists parent_id uuid references news_comments(id) on delete cascade;

create index if not exists news_comments_parent_id_idx
  on news_comments(parent_id, created_at asc);
