-- ============================================================
-- iSport — Player intro video support
-- Apply in Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1. Add column to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS intro_video_url TEXT;

-- ============================================================
-- 2. Create the storage bucket (run this OR do it in the Dashboard)
--    Dashboard → Storage → New bucket
--      Name:   intro-videos
--      Public: true
-- ============================================================
-- If you prefer SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('intro-videos', 'intro-videos', true)
ON CONFLICT (id) DO NOTHING;
