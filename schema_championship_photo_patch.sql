-- ============================================================
-- iSport — Championship photo / icon support
-- Apply in Supabase: Dashboard → SQL Editor → New query
-- IMPORTANT: Apply this BEFORE deploying the code changes
-- ============================================================

-- 1. Add photo_url column to championships table
ALTER TABLE championships
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Create storage bucket for championship photos (public read)
--    OR: Dashboard → Storage → New bucket (name: championship-photos, public: true)
INSERT INTO storage.buckets (id, name, public)
VALUES ('championship-photos', 'championship-photos', true)
ON CONFLICT (id) DO NOTHING;
