-- ============================================================
-- News comments patch
-- Run in Supabase SQL editor AFTER schema_news_patch.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS news_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id    uuid        NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL,
  content    text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_comments_news_id_idx
  ON news_comments(news_id, created_at DESC);

-- RLS
ALTER TABLE news_comments ENABLE ROW LEVEL SECURITY;

-- Everyone can read comments
CREATE POLICY "comments_public_select"
  ON news_comments FOR SELECT
  USING (true);

-- Authenticated users can insert their own comments
CREATE POLICY "comments_auth_insert"
  ON news_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "comments_own_delete"
  ON news_comments FOR DELETE
  USING (auth.uid() = user_id);
