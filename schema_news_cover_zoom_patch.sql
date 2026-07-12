-- ============================================================
-- iSport — News cover image zoom
-- Apply AFTER: schema_news_cover_position_patch.sql
-- Apply in Supabase: Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE news
  ADD COLUMN IF NOT EXISTS cover_zoom REAL DEFAULT 1;
