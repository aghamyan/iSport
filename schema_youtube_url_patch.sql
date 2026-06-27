-- Add youtube_url column to championships for live stream links
ALTER TABLE championships
ADD COLUMN IF NOT EXISTS youtube_url TEXT;
