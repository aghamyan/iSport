-- ============================================================
-- iSport — Championship banner (hero) photo support
-- Apply in Supabase: Dashboard → SQL Editor → New query
-- ============================================================

-- Add banner_url column (separate from photo_url which is the logo/icon)
ALTER TABLE championships
  ADD COLUMN IF NOT EXISTS banner_url TEXT;
