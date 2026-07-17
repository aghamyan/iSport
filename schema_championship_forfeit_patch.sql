-- ============================================================
-- iSport — Forfeit flag for championship matches
-- Apply AFTER schema.sql
-- ============================================================

-- Marks a match as a forfeit (e.g. a player withdrew from the
-- championship). The score itself is entered manually as usual —
-- this column only flags it for display so it's distinguishable
-- from a genuinely played result. It does not change how
-- standings, points, or bet settlement are computed.
alter table championship_matches
  add column is_forfeit boolean not null default false;
