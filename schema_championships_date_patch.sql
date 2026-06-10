-- ============================================================
-- Add played_at to championships
-- Allows backfilling past championships without polluting
-- the "recent N matches" form, since get_player_form orders by
-- coalesce(cm.played_at, cm.confirmed_at). Setting played_at on
-- the championship propagates to all its match rows at creation.
-- ============================================================

alter table championships add column if not exists played_at date;
