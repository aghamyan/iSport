-- ============================================================
-- News feature patch
-- Run in Supabase SQL editor
-- ============================================================

-- 1. News table
CREATE TABLE IF NOT EXISTS news (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  category    text        NOT NULL DEFAULT 'NEWS',
  excerpt     text,
  content     text,
  cover_url   text,
  published   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_news_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER news_updated_at
  BEFORE UPDATE ON news
  FOR EACH ROW EXECUTE FUNCTION update_news_updated_at();

-- 3. RLS — public can read published articles; writes go through service role
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_public_select"
  ON news FOR SELECT
  USING (published = true);

-- 4. Storage bucket  (run this separately OR create manually in Supabase dashboard)
-- Dashboard: Storage → New bucket → name: "news-photos", Public: true
-- SQL alternative (requires pg_net / supabase extensions):
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('news-photos', 'news-photos', true)
-- ON CONFLICT (id) DO NOTHING;
