-- ============================================================
-- iSport — Friendly matches: confirm policy + Realtime support
-- Apply AFTER schema.sql and schema_auth.sql
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- RLS: let the away player confirm a pending match
-- ──────────────────────────────────────────────────────────────
-- The existing "own_match_update" policy (schema_auth.sql) only lets the
-- *creator* update.  The away player is a different user, so they need their
-- own UPDATE policy restricted to the single transition: pending → confirmed.
--
-- Permissive policies are OR-ed, so a row passes if EITHER this policy's
-- USING or "own_match_update"'s USING is satisfied.  WITH CHECK clauses are
-- also OR-ed, so the new row only needs to satisfy one of them.
create policy "away_player_confirm" on friendly_matches
  for update
  using  (away_player_id = auth.uid() and status = 'pending')
  with check (away_player_id = auth.uid());


-- ──────────────────────────────────────────────────────────────
-- Supabase Realtime — enable row-level event streaming
-- ──────────────────────────────────────────────────────────────
-- REPLICA IDENTITY FULL lets Realtime include the old row in UPDATE/DELETE
-- payloads and enables row-level filtering (filter: `id=eq.<uuid>`).
alter table friendly_matches replica identity full;

-- Add the table to the Realtime publication.
-- Without this line the channel subscribes successfully but never receives
-- any events (silent failure).
alter publication supabase_realtime add table friendly_matches;
