-- ============================================================
-- iSport — Allow players to delete their own pending matches
-- Apply AFTER schema.sql
-- ============================================================

-- Only the home or away player can delete a match, and only while it's
-- still pending (not yet confirmed/final).
create policy "own_match_delete" on friendly_matches
  for delete
  using (
    (home_player_id = auth.uid() or away_player_id = auth.uid())
    and status = 'pending'
  );
