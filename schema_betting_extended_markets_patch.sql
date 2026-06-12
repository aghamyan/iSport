-- ============================================================
-- iSport — Extended Markets Patch
-- Apply AFTER: schema_betting_dynamic_options_patch.sql
--
-- Adds:
--   • Converts market_type column from ENUM to TEXT (enables
--     new market type strings without ALTER TYPE migrations)
--   • Expands bet_markets.result constraint to allow multi-winner
--     JSON arrays (for DOUBLE_CHANCE)
--   • Replaces fn_winning_option_for_score with IF/ELSIF chain
--     that handles OU_*, HCP_*, IT_HOME_*, IT_AWAY_* patterns
--   • Adds settle_double_chance_market() for DOUBLE_CHANCE
--   • Replaces settle_match_bets() to route DOUBLE_CHANCE
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. CONVERT market_type FROM ENUM TO TEXT
-- ──────────────────────────────────────────────────────────────

-- The partial index stores 'CUSTOM_PROP' as the enum type.
-- It must be dropped before PostgreSQL can alter the column type,
-- then recreated with the TEXT comparison.
DROP INDEX IF EXISTS uq_market_match_type_standard;

-- Drop any default that casts to the enum first
ALTER TABLE bet_markets
  ALTER COLUMN market_type DROP DEFAULT;

-- Cast column to TEXT (enum values become their string equivalents)
ALTER TABLE bet_markets
  ALTER COLUMN market_type TYPE TEXT USING market_type::text;

-- Drop the enum type (no other tables reference it)
DROP TYPE IF EXISTS market_type;

-- Recreate the partial unique index now that market_type is TEXT
CREATE UNIQUE INDEX uq_market_match_type_standard
  ON bet_markets (match_id, match_type, market_type)
  WHERE market_type != 'CUSTOM_PROP';

-- ──────────────────────────────────────────────────────────────
-- 2. RELAX result CONSTRAINT FOR DOUBLE_CHANCE
--
-- The dynamic_options_patch constrains result to ^option[0-9]+$
-- We extend it to also allow JSON arrays ("[\"option1\",...]")
-- that settle_double_chance_market writes.
-- ──────────────────────────────────────────────────────────────

ALTER TABLE bet_markets
  DROP CONSTRAINT IF EXISTS bet_markets_result_dynamic_option;

ALTER TABLE bet_markets
  ADD CONSTRAINT bet_markets_result_valid
  CHECK (
    result IS NULL
    OR result ~ '^option[0-9]+$'
    OR result LIKE '["option%'
  );

-- ──────────────────────────────────────────────────────────────
-- 3. REPLACE fn_winning_option_for_score
--
-- New patterns handled:
--   OU_*      — Over/Under for any line (parse line from type string)
--   HCP_M*    — Handicap, home gives goals (M = minus, home fav)
--   HCP_P*    — Handicap, home gets goals (P = plus, home dog)
--   IT_HOME_* — Individual Total for home team
--   IT_AWAY_* — Individual Total for away team
--
-- DOUBLE_CHANCE is handled separately (not via this function).
-- CUSTOM_PROP and DOUBLE_CHANCE return NULL → settle_match_bets
-- skips them (CUSTOM_PROP) or re-routes them (DOUBLE_CHANCE).
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_winning_option_for_score(
  p_market_id  uuid,
  p_home_score int,
  p_away_score int
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market      bet_markets%rowtype;
  v_total_goals int  := p_home_score + p_away_score;
  v_home_line   numeric;
  v_away_line   numeric;
  v_ou_line     numeric;
  v_score_label text;
  v_option      text;
BEGIN
  SELECT * INTO v_market FROM bet_markets WHERE market_id = p_market_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Market % not found.', p_market_id;
  END IF;
  IF p_home_score IS NULL OR p_away_score IS NULL THEN
    RAISE EXCEPTION 'Cannot settle market % without final scores.', p_market_id;
  END IF;

  -- ── Match Result ──────────────────────────────────────────────
  IF v_market.market_type = '1X2' THEN
    IF    p_home_score > p_away_score THEN
      v_option := fn_market_option_for_key(v_market.options, 'home');
    ELSIF p_home_score < p_away_score THEN
      v_option := fn_market_option_for_key(v_market.options, 'away');
    ELSE
      v_option := fn_market_option_for_key(v_market.options, 'draw');
    END IF;

  -- ── Legacy Over/Under 2.5 ────────────────────────────────────
  ELSIF v_market.market_type = 'OU2_5' THEN
    v_option := fn_market_option_for_key(
      v_market.options,
      CASE WHEN v_total_goals > 2.5 THEN 'over' ELSE 'under' END
    );

  -- ── New Over/Under lines (OU_0_5, OU_1_0, OU_2_5 …) ─────────
  ELSIF v_market.market_type LIKE 'OU\_%' ESCAPE '\' THEN
    -- Parse: 'OU_2_5' → substring from 4 → '2_5' → replace '_' with '.' → 2.5
    v_ou_line := replace(substring(v_market.market_type FROM 4), '_', '.')::numeric;
    IF    v_total_goals > v_ou_line THEN
      v_option := fn_market_option_for_key(v_market.options, 'over');
    ELSIF v_total_goals < v_ou_line THEN
      v_option := fn_market_option_for_key(v_market.options, 'under');
    ELSE
      RETURN NULL;  -- push on integer lines (e.g. total = 2 for OU_2_0)
    END IF;

  -- ── Legacy Handicap (single auto-suggested line) ──────────────
  ELSIF v_market.market_type = 'HANDICAP' THEN
    v_home_line := COALESCE(fn_market_option_numeric_line(v_market.options, 'option1'), 0);
    v_away_line := COALESCE(fn_market_option_numeric_line(v_market.options, 'option2'), 0);
    IF    p_home_score + v_home_line > p_away_score THEN
      v_option := fn_market_option_for_key(v_market.options, 'home_hcap');
    ELSIF p_away_score + v_away_line > p_home_score THEN
      v_option := fn_market_option_for_key(v_market.options, 'away_hcap');
    ELSE
      RETURN NULL;
    END IF;

  -- ── New Handicap lines (HCP_M* = home gives goals, HCP_P* = home gets goals) ──
  ELSIF v_market.market_type LIKE 'HCP\_%' ESCAPE '\' THEN
    -- 'HCP_M1_5' → char at pos 5 = 'M', substring from 6 = '1_5' → 1.5
    -- v_home_line: negative for M (home gives), positive for P (home gets)
    IF substring(v_market.market_type FROM 5 FOR 1) = 'M' THEN
      v_home_line := -(replace(substring(v_market.market_type FROM 6), '_', '.')::numeric);
    ELSE
      v_home_line :=   replace(substring(v_market.market_type FROM 6), '_', '.')::numeric;
    END IF;
    v_away_line := -v_home_line;

    IF    p_home_score + v_home_line > p_away_score THEN
      v_option := fn_market_option_for_key(v_market.options, 'home_hcap');
    ELSIF p_away_score + v_away_line > p_home_score THEN
      v_option := fn_market_option_for_key(v_market.options, 'away_hcap');
    ELSE
      RETURN NULL;  -- push on integer lines
    END IF;

  -- ── Both Teams to Score ───────────────────────────────────────
  ELSIF v_market.market_type = 'BTTS' THEN
    v_option := fn_market_option_for_key(
      v_market.options,
      CASE WHEN p_home_score > 0 AND p_away_score > 0 THEN 'yes' ELSE 'no' END
    );

  -- ── Individual Total — Home Team ─────────────────────────────
  ELSIF v_market.market_type LIKE 'IT\_HOME\_%' ESCAPE '\' THEN
    -- 'IT_HOME_1_5' → substring from 9 = '1_5' → 1.5
    v_ou_line := replace(substring(v_market.market_type FROM 9), '_', '.')::numeric;
    IF    p_home_score > v_ou_line THEN
      v_option := fn_market_option_for_key(v_market.options, 'over');
    ELSIF p_home_score < v_ou_line THEN
      v_option := fn_market_option_for_key(v_market.options, 'under');
    ELSE
      RETURN NULL;
    END IF;

  -- ── Individual Total — Away Team ─────────────────────────────
  ELSIF v_market.market_type LIKE 'IT\_AWAY\_%' ESCAPE '\' THEN
    v_ou_line := replace(substring(v_market.market_type FROM 9), '_', '.')::numeric;
    IF    p_away_score > v_ou_line THEN
      v_option := fn_market_option_for_key(v_market.options, 'over');
    ELSIF p_away_score < v_ou_line THEN
      v_option := fn_market_option_for_key(v_market.options, 'under');
    ELSE
      RETURN NULL;
    END IF;

  -- ── Exact Score ──────────────────────────────────────────────
  ELSIF v_market.market_type = 'EXACT_SCORE' THEN
    v_score_label := p_home_score || '-' || p_away_score;
    v_option := COALESCE(
      fn_market_option_for_label(v_market.options, v_score_label),
      fn_market_option_for_key(v_market.options, 'other'),
      fn_market_option_for_label(v_market.options, 'Other')
    );

  -- ── All others (CUSTOM_PROP, DOUBLE_CHANCE handled upstream) ─
  ELSE
    RETURN NULL;
  END IF;

  IF v_option IS NULL OR NOT (v_market.options ? v_option) THEN
    RAISE EXCEPTION 'Could not derive winning option for market % (%).', p_market_id, v_market.market_type;
  END IF;

  RETURN v_option;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 4. NEW: settle_double_chance_market
--
-- Double Chance has exactly ONE loser and TWO winners per match
-- result — the standard settle_market (single winner) cannot
-- handle this. This function marks bets correctly:
--   Home win  → 1X (home_or_draw) ✓  |  X2 ✗  |  12 (no_draw) ✓
--   Away win  → 1X ✗  |  X2 (away_or_draw) ✓  |  12 ✓
--   Draw      → 1X ✓  |  X2 ✓  |  12 ✗
--
-- Stores winning option keys as a JSON array in result column.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION settle_double_chance_market(
  p_market_id  uuid,
  p_home_score int,
  p_away_score int,
  p_admin_id   uuid
)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market      bet_markets%rowtype;
  v_win_keys    text[];
  v_win_options text[];
  v_bet_id      uuid;
  v_outcome     text;
  v_count       int := 0;
BEGIN
  SELECT * INTO v_market FROM bet_markets WHERE market_id = p_market_id;

  -- Determine which INNER keys win based on score
  IF    p_home_score > p_away_score THEN
    v_win_keys := ARRAY['home_or_draw', 'no_draw'];
  ELSIF p_home_score < p_away_score THEN
    v_win_keys := ARRAY['away_or_draw', 'no_draw'];
  ELSE
    v_win_keys := ARRAY['home_or_draw', 'away_or_draw'];
  END IF;

  -- Translate inner keys to outer option* keys
  SELECT array_agg(opt.key ORDER BY opt.key)
  INTO v_win_options
  FROM jsonb_each(v_market.options) AS opt(key, value)
  WHERE opt.value ->> 'key' = ANY(v_win_keys);

  -- Mark market SETTLED; result stores a JSON array of winning outer keys
  UPDATE bet_markets
  SET status     = 'SETTLED',
      result     = array_to_json(v_win_options)::text,
      settled_at = now(),
      settled_by = p_admin_id
  WHERE market_id = p_market_id;

  -- Update parlay legs
  UPDATE parlay_legs
  SET result     = CASE
                     WHEN selected_option = ANY(v_win_options) THEN 'WON'::leg_result
                     ELSE                                           'LOST'::leg_result
                   END,
      settled_at = now()
  WHERE market_id = p_market_id;

  -- Settle single bets
  FOR v_bet_id IN
    SELECT bet_id FROM bets
    WHERE market_id = p_market_id
      AND bet_type  = 'SINGLE'
      AND status    = 'PENDING'
  LOOP
    SELECT CASE WHEN selected_option = ANY(v_win_options) THEN 'WON' ELSE 'LOST' END
    INTO v_outcome
    FROM bets WHERE bet_id = v_bet_id;

    PERFORM settle_bet(v_bet_id, v_outcome, p_admin_id, 'Auto-settled: Double Chance market');
    v_count := v_count + 1;
  END LOOP;

  -- Resolve parlay bets whose last pending leg was on this market
  FOR v_bet_id IN
    SELECT DISTINCT pl.bet_id
    FROM parlay_legs pl
    JOIN bets b ON b.bet_id = pl.bet_id
    WHERE pl.market_id = p_market_id
      AND b.status     = 'PENDING'
      AND b.bet_type   = 'PARLAY'
  LOOP
    IF fn_resolve_parlay(v_bet_id, p_admin_id, 'Auto-settled: Double Chance market') THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 5. REPLACE settle_match_bets
--
-- Adds special-case routing for DOUBLE_CHANCE before the
-- standard fn_winning_option_for_score path.
-- All other logic is identical to the previous version.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION settle_match_bets(
  p_match_id   uuid,
  p_match_type match_ref_type,
  p_admin_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_home_score      int;
  v_away_score      int;
  v_status          match_status;
  v_started_at      timestamptz := now();
  v_market          record;
  v_winning_option  text;
  v_bets_settled    int;
  v_markets_settled int := 0;
  v_markets_skipped int := 0;
  v_failed_count    int := 0;
  v_bets_affected   int := 0;
  v_total_staked    numeric := 0;
  v_total_winnings  numeric := 0;
  v_total_rake      numeric := 0;
  v_audit_id        uuid;
  v_result          jsonb;
BEGIN
  IF p_match_type = 'friendly' THEN
    SELECT status, home_score, away_score
    INTO v_status, v_home_score, v_away_score
    FROM friendly_matches WHERE id = p_match_id;
  ELSE
    SELECT status, home_score, away_score
    INTO v_status, v_home_score, v_away_score
    FROM championship_matches WHERE id = p_match_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % (%) not found.', p_match_id, p_match_type;
  END IF;
  IF v_status != 'final' THEN
    RAISE EXCEPTION 'Match % is %, not final.', p_match_id, v_status;
  END IF;
  IF v_home_score IS NULL OR v_away_score IS NULL THEN
    RAISE EXCEPTION 'Match % cannot settle without final scores.', p_match_id;
  END IF;

  FOR v_market IN
    SELECT market_id, market_type
    FROM bet_markets
    WHERE match_id   = p_match_id
      AND match_type = p_match_type
      AND status IN ('OPEN','LOCKED')
    ORDER BY created_at
  LOOP
    BEGIN
      -- CUSTOM_PROP: skip, needs manual settlement
      IF v_market.market_type = 'CUSTOM_PROP' THEN
        v_markets_skipped := v_markets_skipped + 1;
        CONTINUE;
      END IF;

      -- DOUBLE_CHANCE: multi-winner settlement via dedicated function
      IF v_market.market_type = 'DOUBLE_CHANCE' THEN
        v_bets_settled := settle_double_chance_market(
          v_market.market_id, v_home_score, v_away_score, p_admin_id
        );
        v_markets_settled := v_markets_settled + 1;
        v_bets_affected   := v_bets_affected + COALESCE(v_bets_settled, 0);
        CONTINUE;
      END IF;

      -- All other standard markets
      v_winning_option := fn_winning_option_for_score(
        v_market.market_id, v_home_score, v_away_score
      );

      IF v_winning_option IS NULL THEN
        -- Push / no winner → cancel market, refund all bets
        v_bets_settled := cancel_market(
          v_market.market_id,
          p_admin_id,
          'Market returned by final-score settlement (push/no winner)'
        );
      ELSE
        v_bets_settled := settle_market(v_market.market_id, v_winning_option, p_admin_id);
      END IF;

      v_markets_settled := v_markets_settled + 1;
      v_bets_affected   := v_bets_affected + COALESCE(v_bets_settled, 0);

    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      INSERT INTO bet_settlement_errors (
        match_id, match_type, market_id, error_message
      ) VALUES (
        p_match_id, p_match_type, v_market.market_id, SQLERRM
      );
    END;
  END LOOP;

  -- Aggregate final settlement totals
  SELECT
    count(*),
    COALESCE(sum(bet_amount), 0),
    COALESCE(sum(actual_winnings) FILTER (WHERE status = 'WON'), 0),
    COALESCE(sum(rake_amount)     FILTER (WHERE status = 'WON'), 0)
  INTO v_bets_affected, v_total_staked, v_total_winnings, v_total_rake
  FROM bets b
  WHERE b.settled_at >= v_started_at
    AND (
      EXISTS (
        SELECT 1 FROM bet_markets bm
        WHERE bm.market_id = b.market_id
          AND bm.match_id  = p_match_id
          AND bm.match_type = p_match_type
      )
      OR EXISTS (
        SELECT 1 FROM parlay_legs pl
        JOIN bet_markets bm ON bm.market_id = pl.market_id
        WHERE pl.bet_id     = b.bet_id
          AND bm.match_id   = p_match_id
          AND bm.match_type = p_match_type
      )
    );

  v_result := jsonb_build_object(
    'home_score', v_home_score,
    'away_score', v_away_score,
    'score',      v_home_score || '-' || v_away_score
  );

  INSERT INTO bet_settlement_audit (
    match_id, match_type, result,
    markets_settled, markets_skipped, failed_count,
    bets_affected, total_staked, total_winnings_paid, total_rake_collected,
    settlement_status, triggered_by
  ) VALUES (
    p_match_id, p_match_type, v_result,
    v_markets_settled, v_markets_skipped, v_failed_count,
    v_bets_affected, v_total_staked, v_total_winnings, v_total_rake,
    CASE
      WHEN v_failed_count > 0 AND v_markets_settled = 0 THEN 'FAILED'
      WHEN v_failed_count > 0 OR v_markets_skipped  > 0 THEN 'PARTIAL'
      ELSE 'SUCCESS'
    END,
    p_admin_id
  )
  RETURNING audit_id INTO v_audit_id;

  UPDATE bet_settlement_errors
  SET audit_id = v_audit_id
  WHERE audit_id  IS NULL
    AND match_id   = p_match_id
    AND match_type = p_match_type
    AND created_at >= v_started_at;

  RETURN jsonb_build_object(
    'audit_id',             v_audit_id,
    'match_id',             p_match_id,
    'match_type',           p_match_type,
    'result',               v_result,
    'markets_settled',      v_markets_settled,
    'markets_skipped',      v_markets_skipped,
    'failed_count',         v_failed_count,
    'bets_affected',        v_bets_affected,
    'total_staked',         v_total_staked,
    'total_winnings_paid',  v_total_winnings,
    'total_rake_collected', v_total_rake
  );
END;
$$;
