-- ============================================================
-- iSport — Group-Knockout championship format
-- Apply AFTER all previous schema files.
-- ============================================================

-- Step 1: add the new enum value (must be its own statement in Postgres)
ALTER TYPE champ_format ADD VALUE IF NOT EXISTS 'group_knockout';

-- Step 2: add structural columns to championship_matches
ALTER TABLE championship_matches
  ADD COLUMN IF NOT EXISTS group_label text,   -- 'A' | 'B' | null (knockout)
  ADD COLUMN IF NOT EXISTS round      text,    -- 'group' | 'semi' | 'final' | 'penalty'
  ADD COLUMN IF NOT EXISTS leg        smallint; -- 1 | 2 for semi legs, null otherwise
