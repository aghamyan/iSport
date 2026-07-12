-- ============================================================
-- News comments FK fix
-- Run in Supabase SQL editor AFTER schema_news_comments_patch.sql
--
-- news_comments.user_id was created without a foreign key to
-- users(id), unlike every other user_id/player_id column in the
-- schema. This adds it for referential integrity.
-- ============================================================

ALTER TABLE news_comments
  ADD CONSTRAINT news_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
