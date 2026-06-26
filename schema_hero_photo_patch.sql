-- ============================================================
-- iSport — Player hero photo support
-- Apply in Supabase: Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Add columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hero_photo_url TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS hero_photo_position TEXT DEFAULT '50% 15%';

-- 2. Create the storage bucket
--    OR: Dashboard → Storage → New bucket (name: hero-photos, public: true)
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-photos', 'hero-photos', true)
ON CONFLICT (id) DO NOTHING;
