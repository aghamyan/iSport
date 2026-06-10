-- ============================================================
-- iSport — DB Integrity Fix
-- Paste this entire file into the Supabase SQL Editor and run it.
--
-- Fixes:
--   1. Backfill missing players rows (causes championship_players FK violation)
--   2. championship_players: ON DELETE RESTRICT → CASCADE (allows player deletion)
--   3. championship_standings: ON DELETE RESTRICT → CASCADE (allows player deletion)
--   4. admin_activity_log: admin_id nullable + ON DELETE SET NULL (allows admin deletion)
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. BACKFILL: create players rows for any users that don't have one
--
-- This fixes the "championship_players_player_id_fkey" error.
-- Any user created directly in Supabase (not through the app)
-- will be missing a players row, making championship_players
-- inserts fail.
-- ──────────────────────────────────────────────────────────────
insert into players (id, display_name)
select u.id, u.name
from users u
left join players p on p.id = u.id
where p.id is null
on conflict (id) do nothing;


-- ──────────────────────────────────────────────────────────────
-- 2. championship_players: allow player deletion to cascade
--
-- ON DELETE RESTRICT blocks deleting any player who appears in
-- a championship roster, even if they have played zero matches.
-- Changing to CASCADE removes them from the roster automatically.
-- ──────────────────────────────────────────────────────────────
alter table championship_players
  drop constraint if exists championship_players_player_id_fkey;

alter table championship_players
  add constraint championship_players_player_id_fkey
  foreign key (player_id) references players(id) on delete cascade;


-- ──────────────────────────────────────────────────────────────
-- 3. championship_standings: allow player deletion to cascade
--
-- Same problem as above — standings rows block deletion even
-- when no matches have been played.
-- ──────────────────────────────────────────────────────────────
alter table championship_standings
  drop constraint if exists championship_standings_player_id_fkey;

alter table championship_standings
  add constraint championship_standings_player_id_fkey
  foreign key (player_id) references players(id) on delete cascade;


-- ──────────────────────────────────────────────────────────────
-- 4. admin_activity_log: allow admin user deletion
--
-- The NOT NULL + ON DELETE RESTRICT on admin_id makes it
-- impossible to delete any admin who has ever performed an
-- action. We preserve the audit history but allow the user to
-- be deleted by making admin_id nullable and setting it to NULL
-- on user deletion.
-- ──────────────────────────────────────────────────────────────
alter table admin_activity_log
  drop constraint if exists admin_activity_log_admin_id_fkey;

alter table admin_activity_log
  alter column admin_id drop not null;

alter table admin_activity_log
  add constraint admin_activity_log_admin_id_fkey
  foreign key (admin_id) references users(id) on delete set null;


-- ──────────────────────────────────────────────────────────────
-- RESULT
--
-- After running this:
--   • All existing users now have players rows → no more FK
--     violations when adding players to championships
--   • Deleting a player who has only been added to championships
--     (but has no matches) will succeed — they are removed from
--     championship_players and championship_standings automatically
--   • Deleting a player who HAS friendly_matches, championship_matches,
--     or rivalries will still fail with a 23503 error — this is
--     intentional. Use "Deactivate" for players with match history.
--   • Deleting an admin user no longer fails if they have activity
--     log entries — those entries keep their data with admin_id = NULL
-- ──────────────────────────────────────────────────────────────
