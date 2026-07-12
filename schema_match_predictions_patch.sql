-- ============================================================
-- iSport — Match Predictor
-- Apply AFTER: schema.sql, schema_auth.sql, schema_championships_patch.sql
--
-- Lets any logged-in user pick the outcome (home win / draw / away win) of
-- a championship match while it is still pending, then submit the pick.
-- +1 point for a correct pick once the match result is confirmed; wrong
-- picks score 0. A submitted pick is immutable — there is no update path,
-- only insert-if-absent (see submitPredictionsAction's ignoreDuplicates
-- upsert), so once locked in it can never be changed, including by the
-- same player resubmitting.
--
-- Correctness is computed on read from championship_matches.home_score /
-- away_score in app/championships/predictorActions.ts, not stored here — so
-- a later score correction is reflected automatically instead of going stale.
--
-- Writes always go through the service-role client from Server Actions
-- (app/championships/predictorActions.ts), which independently verify every
-- match in a submission batch is still 'pending' before accepting any of
-- it. The RLS policy below is read-only defense-in-depth, not the primary
-- access control (same convention as schema_match_interviews_patch.sql).
-- ============================================================

-- Idempotent guards throughout: this file is run by hand in the Supabase SQL
-- editor, so a partial run must be safely re-runnable from the top.
do $$ begin
  create type prediction_pick as enum ('home', 'draw', 'away');
exception when duplicate_object then null; end $$;

create table if not exists match_predictions (
  id                    uuid primary key default gen_random_uuid(),
  championship_match_id uuid not null references championship_matches(id) on delete cascade,
  player_id             uuid not null references users(id) on delete cascade,
  pick                  prediction_pick not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint mp_unique_match_player unique (championship_match_id, player_id)
);

create index if not exists idx_mp_match  on match_predictions(championship_match_id);
create index if not exists idx_mp_player on match_predictions(player_id);

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────
alter table match_predictions enable row level security;

drop policy if exists "own_or_admin_read" on match_predictions;
create policy "own_or_admin_read" on match_predictions for select
  using (
    player_id = auth.uid()
    or (select is_admin from users where id = auth.uid())
  );

comment on table match_predictions is
  'One Win/Draw/Loss pick per (championship match, player), made while the match is still pending. '
  'Scoring (+1 for a correct pick) is computed on read in app/championships/predictorActions.ts, not stored.';
