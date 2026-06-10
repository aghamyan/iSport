-- ============================================================
-- iSport — Performance patch
-- Apply AFTER all prior schema patches.
-- All indexes use IF NOT EXISTS — safe to re-run.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- championship_players
-- getPlayerChampionshipPlacements filters by player_id.
-- getChampionshipLeaders scans all rows — championship_id is
-- the PK prefix so that direction is already fast; player_id
-- lookups need their own index.
-- ──────────────────────────────────────────────────────────────
create index if not exists idx_cp_player
  on championship_players(player_id);


-- ──────────────────────────────────────────────────────────────
-- championship_standings
-- getSeasonalStats and any direct standings queries filter by
-- player_id. The PK is (championship_id, player_id) so
-- player_id-only lookups require a separate index.
-- ──────────────────────────────────────────────────────────────
create index if not exists idx_cs_player
  on championship_standings(player_id);


-- ──────────────────────────────────────────────────────────────
-- H2H composite indexes
-- get_h2h_stats UNIONs friendly + championship matches with a
-- two-sided predicate:
--   (home = p1 AND away = p2) OR (home = p2 AND away = p1)
-- A composite (home, away) partial index covers one ordering;
-- the existing idx_fm_home / idx_fm_away cover single-column
-- lookups but the planner needs both columns to avoid a seq scan
-- on the confirmed subset for large match histories.
-- ──────────────────────────────────────────────────────────────
create index if not exists idx_fm_h2h
  on friendly_matches(home_player_id, away_player_id)
  where status = 'confirmed';

create index if not exists idx_cm_h2h
  on championship_matches(home_player_id, away_player_id)
  where status = 'confirmed';


-- ──────────────────────────────────────────────────────────────
-- championship_matches — championship + cycle ordering
-- Championship detail page orders matches by cycle; adding cycle
-- to the championship_id index avoids a sort step.
-- ──────────────────────────────────────────────────────────────
create index if not exists idx_cm_champ_cycle
  on championship_matches(championship_id, cycle, status);


-- ──────────────────────────────────────────────────────────────
-- friendly_matches — created_by
-- Admin match management page (app/admin/matches/) filters by
-- created_by. Without this index the query scans the full table.
-- ──────────────────────────────────────────────────────────────
create index if not exists idx_fm_created_by
  on friendly_matches(created_by);


-- ──────────────────────────────────────────────────────────────
-- rivalries — status filter
-- Active-rivalry queries (.eq('status', 'active')) run on every
-- home page load. The existing p1/p2 indexes don't help when
-- filtering by status only.
-- ──────────────────────────────────────────────────────────────
create index if not exists idx_rivalries_active
  on rivalries(status)
  where status = 'active';
