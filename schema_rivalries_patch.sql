-- ============================================================
-- iSport — Personal Rivalries: RLS, Realtime, RPC, badge seed
-- Apply AFTER schema.sql, schema_auth.sql
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- RLS on tables not yet enabled
-- ──────────────────────────────────────────────────────────────
alter table rivalry_matches enable row level security;
alter table badges          enable row level security;
alter table player_badges   enable row level security;

-- Public read on all rivalry-related tables
create policy "read_all" on rivalry_matches for select using (true);
create policy "read_all" on badges          for select using (true);
create policy "read_all" on player_badges   for select using (true);


-- ──────────────────────────────────────────────────────────────
-- Rivalry write policies
-- ──────────────────────────────────────────────────────────────
-- Either participant may create a rivalry (canonical ordering enforced by check constraint)
create policy "participant_rivalry_insert" on rivalries for insert
  with check (player1_id = auth.uid() or player2_id = auth.uid());

-- Either participant or admin may update (win counts, completion)
create policy "participant_rivalry_update" on rivalries for update
  using (
    player1_id = auth.uid() or player2_id = auth.uid()
    or (select is_admin from users where id = auth.uid())
  )
  with check (
    player1_id = auth.uid() or player2_id = auth.uid()
    or (select is_admin from users where id = auth.uid())
  );

create policy "admin_rivalry_delete" on rivalries for delete
  using ((select is_admin from users where id = auth.uid()));


-- ──────────────────────────────────────────────────────────────
-- Realtime on rivalries
-- ──────────────────────────────────────────────────────────────
alter table rivalries replica identity full;
alter publication supabase_realtime add table rivalries;


-- ──────────────────────────────────────────────────────────────
-- Seed: Rivalry Champion badge
-- ──────────────────────────────────────────────────────────────
insert into badges (name, description, badge_type)
values ('Rivalry Champion', 'Won a personal best-of rivalry series', 'rivalry_won')
on conflict (name) do nothing;


-- ──────────────────────────────────────────────────────────────
-- Atomic match recording RPC
-- Runs as security definer so it can write friendly_matches and
-- rivalry_matches regardless of the caller's RLS policies.
-- auth.uid() is preserved inside security definer functions in Supabase.
-- ──────────────────────────────────────────────────────────────
create or replace function record_rivalry_match(
  p_rivalry_id    uuid,
  p_player1_score smallint,
  p_player2_score smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_rivalry  rivalries%rowtype;
  v_match_id uuid;
  v_p1_wins  int;
  v_p2_wins  int;
  v_winner   uuid;
  v_complete boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the row to prevent concurrent win-count races
  select * into v_rivalry
  from rivalries
  where id = p_rivalry_id
  for update;

  if not found then
    raise exception 'Rivalry not found';
  end if;

  if v_uid <> v_rivalry.player1_id and v_uid <> v_rivalry.player2_id then
    raise exception 'Not a participant in this rivalry';
  end if;

  if v_rivalry.status = 'completed' then
    raise exception 'This rivalry series is already completed';
  end if;

  -- Record the match (player1 = home, player2 = away by convention)
  insert into friendly_matches (
    home_player_id, away_player_id,
    home_score, away_score,
    status, confirmed_at, created_by
  ) values (
    v_rivalry.player1_id, v_rivalry.player2_id,
    p_player1_score, p_player2_score,
    'confirmed', now(), v_uid
  )
  returning id into v_match_id;

  insert into rivalry_matches (rivalry_id, match_id)
  values (p_rivalry_id, v_match_id);

  -- Increment wins (draws advance neither player)
  v_p1_wins := v_rivalry.player1_wins;
  v_p2_wins := v_rivalry.player2_wins;

  if p_player1_score > p_player2_score then
    v_p1_wins := v_p1_wins + 1;
  elsif p_player2_score > p_player1_score then
    v_p2_wins := v_p2_wins + 1;
  end if;

  -- Series completion: first to reach best_of wins
  if v_p1_wins >= v_rivalry.best_of then
    v_winner   := v_rivalry.player1_id;
    v_complete := true;
  elsif v_p2_wins >= v_rivalry.best_of then
    v_winner   := v_rivalry.player2_id;
    v_complete := true;
  end if;

  update rivalries set
    player1_wins = v_p1_wins,
    player2_wins = v_p2_wins,
    winner_id    = case when v_complete then v_winner   else null end,
    status       = case when v_complete then 'completed'::rivalry_status else 'active'::rivalry_status end,
    completed_at = case when v_complete then now()      else null end
  where id = p_rivalry_id;

  return jsonb_build_object(
    'match_id',    v_match_id,
    'player1_wins', v_p1_wins,
    'player2_wins', v_p2_wins,
    'completed',   v_complete,
    'winner_id',   v_winner
  );
end;
$$;
