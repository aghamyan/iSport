-- ============================================================
-- iSport — Player intro audio support
-- Apply in Supabase: Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Add columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS intro_audio_url TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS intro_audio_trim_start FLOAT DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS intro_audio_trim_end FLOAT;

-- 2. Create the storage bucket
--    OR: Dashboard → Storage → New bucket (name: intro-audio, public: true)
INSERT INTO storage.buckets (id, name, public)
VALUES ('intro-audio', 'intro-audio', true)
ON CONFLICT (id) DO NOTHING;
