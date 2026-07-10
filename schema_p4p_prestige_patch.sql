-- ============================================================
-- iSport — P4P v2: championship prestige weighting
-- Apply AFTER all previous schema files.
--
-- Adds a single admin-settable weight per championship so the
-- redesigned P4P "Championship Legacy" pillar can value a World
-- Championship above a Friendly Cup (see lib/stats/p4p.ts).
--
-- No other schema changes are required for the P4P v2 redesign —
-- Strength of Schedule and Recent Form are computed transiently
-- from existing championship_matches rows (see getChampionshipMatchHistory
-- in lib/stats/queries.ts), not persisted.
-- ============================================================

ALTER TABLE championships
  ADD COLUMN IF NOT EXISTS prestige_weight numeric NOT NULL DEFAULT 2
    CHECK (prestige_weight > 0);

COMMENT ON COLUMN championships.prestige_weight IS
  'Relative prestige used by the P4P Championship Legacy pillar. '
  'Auto-derived from player count at creation time (see '
  'lib/championships/prestige.ts), not admin-picked: '
  '2-4 players -> 2 (friendly), 5-6 players -> 4 (standard), '
  '7+ players -> 8 (major). The column stays a free numeric so it can '
  'still be corrected by hand (e.g. via SQL) for older championships.';

-- Existing championships default to 2 ("friendly") until backfilled from
-- their actual historical player count — see the backfill note in the
-- P4P design doc for a one-off UPDATE using real championship_players counts.
