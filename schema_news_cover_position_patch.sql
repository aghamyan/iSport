-- ============================================================
-- iSport — News cover image repositioning
-- Apply in Supabase: Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE news
  ADD COLUMN IF NOT EXISTS cover_position TEXT DEFAULT '50% 50%';
