-- ============================================================
-- iSport — Rivalries: draws tracking + initial history support
-- Apply AFTER schema_rivalries_patch.sql
-- ============================================================

-- Add draws column to rivalries (tracks both pre-existing and recorded draws)
ALTER TABLE rivalries
  ADD COLUMN IF NOT EXISTS draws INTEGER NOT NULL DEFAULT 0;

-- Update the RPC to increment draws when a match ends in a draw
CREATE OR REPLACE FUNCTION record_rivalry_match(
  p_rivalry_id    uuid,
  p_player1_score smallint,
  p_player2_score smallint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_rivalry  rivalries%rowtype;
  v_match_id uuid;
  v_p1_wins  int;
  v_p2_wins  int;
  v_draws    int;
  v_winner   uuid;
  v_complete boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the row to prevent concurrent win-count races
  SELECT * INTO v_rivalry
  FROM rivalries
  WHERE id = p_rivalry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rivalry not found';
  END IF;

  IF v_uid <> v_rivalry.player1_id AND v_uid <> v_rivalry.player2_id THEN
    RAISE EXCEPTION 'Not a participant in this rivalry';
  END IF;

  IF v_rivalry.status = 'completed' THEN
    RAISE EXCEPTION 'This rivalry series is already completed';
  END IF;

  -- Record the match (player1 = home, player2 = away by convention)
  INSERT INTO friendly_matches (
    home_player_id, away_player_id,
    home_score, away_score,
    status, confirmed_at, created_by
  ) VALUES (
    v_rivalry.player1_id, v_rivalry.player2_id,
    p_player1_score, p_player2_score,
    'confirmed', now(), v_uid
  )
  RETURNING id INTO v_match_id;

  INSERT INTO rivalry_matches (rivalry_id, match_id)
  VALUES (p_rivalry_id, v_match_id);

  v_p1_wins := v_rivalry.player1_wins;
  v_p2_wins := v_rivalry.player2_wins;
  v_draws   := v_rivalry.draws;

  IF p_player1_score > p_player2_score THEN
    v_p1_wins := v_p1_wins + 1;
  ELSIF p_player2_score > p_player1_score THEN
    v_p2_wins := v_p2_wins + 1;
  ELSE
    v_draws := v_draws + 1;
  END IF;

  -- Series completion: first to reach best_of wins
  IF v_p1_wins >= v_rivalry.best_of THEN
    v_winner   := v_rivalry.player1_id;
    v_complete := true;
  ELSIF v_p2_wins >= v_rivalry.best_of THEN
    v_winner   := v_rivalry.player2_id;
    v_complete := true;
  END IF;

  UPDATE rivalries SET
    player1_wins = v_p1_wins,
    player2_wins = v_p2_wins,
    draws        = v_draws,
    winner_id    = CASE WHEN v_complete THEN v_winner   ELSE NULL END,
    status       = CASE WHEN v_complete THEN 'completed'::rivalry_status ELSE 'active'::rivalry_status END,
    completed_at = CASE WHEN v_complete THEN now()      ELSE NULL END
  WHERE id = p_rivalry_id;

  RETURN jsonb_build_object(
    'match_id',     v_match_id,
    'player1_wins', v_p1_wins,
    'player2_wins', v_p2_wins,
    'draws',        v_draws,
    'completed',    v_complete,
    'winner_id',    v_winner
  );
END;
$$;
