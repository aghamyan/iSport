-- ============================================================
-- iSport — Player social links (Instagram + Yandex Navi)
-- Apply in Supabase: Dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS instagram_url TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS navi_coords TEXT;
