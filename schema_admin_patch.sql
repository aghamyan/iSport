-- ============================================================
-- iSport — Admin Dashboard Schema Patch
-- Apply AFTER: schema_stats_patch.sql
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- Fix 'final' status in stats functions
-- The original functions only counted status = 'confirmed'.
-- 'final' matches must count identically — they are locked,
-- confirmed matches. Replacing all five affected functions.
-- ──────────────────────────────────────────────────────────────

create or replace function recompute_player_stats(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wins   int := 0;
  v_draws  int := 0;
  v_losses int := 0;
  v_gf     int := 0;
  v_ga     int := 0;
begin
  perform id from players where id = p_player_id for update;

  select
    coalesce(count(*) filter (where
      (home_player_id = p_player_id and home_score > away_score)
      or (away_player_id = p_player_id and away_score > home_score)
    ), 0),
    coalesce(count(*) filter (where home_score = away_score), 0),
    coalesce(count(*) filter (where
      (home_player_id = p_player_id and home_score < away_score)
      or (away_player_id = p_player_id and away_score < home_score)
    ), 0),
    coalesce(sum(case
      when home_player_id = p_player_id then home_score::int
      else away_score::int
    end), 0),
    coalesce(sum(case
      when home_player_id = p_player_id then away_score::int
      else home_score::int
    end), 0)
  into v_wins, v_draws, v_losses, v_gf, v_ga
  from (
    select home_player_id, away_player_id, home_score, away_score
    from friendly_matches
    where status in ('confirmed', 'final')
      and (home_player_id = p_player_id or away_player_id = p_player_id)
      and home_score is not null and away_score is not null
    union all
    select home_player_id, away_player_id, home_score, away_score
    from championship_matches
    where status in ('confirmed', 'final')
      and (home_player_id = p_player_id or away_player_id = p_player_id)
      and home_score is not null and away_score is not null
  ) m;

  update players set
    wins          = v_wins,
    draws         = v_draws,
    losses        = v_losses,
    goals_for     = v_gf,
    goals_against = v_ga,
    updated_at    = now()
  where id = p_player_id;
end;
$$;


create or replace function recompute_championship_standings(
  p_championship_id uuid,
  p_player_id       uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_played int := 0;
  v_wins   int := 0;
  v_draws  int := 0;
  v_losses int := 0;
  v_gf     int := 0;
  v_ga     int := 0;
begin
  select
    coalesce(count(*), 0),
    coalesce(count(*) filter (where
      (home_player_id = p_player_id and home_score > away_score)
      or (away_player_id = p_player_id and away_score > home_score)
    ), 0),
    coalesce(count(*) filter (where home_score = away_score), 0),
    coalesce(count(*) filter (where
      (home_player_id = p_player_id and home_score < away_score)
      or (away_player_id = p_player_id and away_score < home_score)
    ), 0),
    coalesce(sum(case
      when home_player_id = p_player_id then home_score::int
      else away_score::int
    end), 0),
    coalesce(sum(case
      when home_player_id = p_player_id then away_score::int
      else home_score::int
    end), 0)
  into v_played, v_wins, v_draws, v_losses, v_gf, v_ga
  from championship_matches
  where championship_id = p_championship_id
    and status in ('confirmed', 'final')
    and (home_player_id = p_player_id or away_player_id = p_player_id)
    and home_score is not null;

  insert into championship_standings (
    championship_id, player_id,
    played, wins, draws, losses,
    goals_for, goals_against,
    updated_at
  ) values (
    p_championship_id, p_player_id,
    v_played, v_wins, v_draws, v_losses,
    v_gf, v_ga,
    now()
  )
  on conflict (championship_id, player_id) do update set
    played        = excluded.played,
    wins          = excluded.wins,
    draws         = excluded.draws,
    losses        = excluded.losses,
    goals_for     = excluded.goals_for,
    goals_against = excluded.goals_against,
    updated_at    = now();
end;
$$;


-- Update trigger function to fire on → 'final' transitions too
create or replace function trg_friendly_stats_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('confirmed', 'final') and new.home_score is not null then
      perform recompute_player_stats(new.home_player_id);
      perform recompute_player_stats(new.away_player_id);
    end if;

  elsif tg_op = 'UPDATE' then
    if (old.status is distinct from new.status and new.status in ('confirmed', 'final'))
       or (new.status in ('confirmed', 'final') and (
             new.home_score is distinct from old.home_score
             or new.away_score is distinct from old.away_score
           ))
    then
      perform recompute_player_stats(new.home_player_id);
      perform recompute_player_stats(new.away_player_id);
    end if;
  end if;
  return null;
end;
$$;


create or replace function trg_championship_stats_fn()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('confirmed', 'final') and new.home_score is not null then
      perform recompute_player_stats(new.home_player_id);
      perform recompute_player_stats(new.away_player_id);
      perform recompute_championship_standings(new.championship_id, new.home_player_id);
      perform recompute_championship_standings(new.championship_id, new.away_player_id);
    end if;

  elsif tg_op = 'UPDATE' then
    if (old.status is distinct from new.status and new.status in ('confirmed', 'final'))
       or (new.status in ('confirmed', 'final') and (
             new.home_score is distinct from old.home_score
             or new.away_score is distinct from old.away_score
           ))
    then
      perform recompute_player_stats(new.home_player_id);
      perform recompute_player_stats(new.away_player_id);
      perform recompute_championship_standings(new.championship_id, new.home_player_id);
      perform recompute_championship_standings(new.championship_id, new.away_player_id);
    end if;
  end if;
  return null;
end;
$$;


create or replace function get_player_form(p_player_id uuid, p_limit int default 5)
returns table (
  match_id       uuid,
  opponent_id    uuid,
  opponent_name  text,
  result         text,
  goals_for      int,
  goals_against  int,
  played_at      timestamptz,
  match_type     text
)
language sql
security definer
set search_path = public
as $$
  with matches as (
    select
      fm.id as match_id,
      case when fm.home_player_id = p_player_id
           then fm.away_player_id
           else fm.home_player_id end                       as opponent_id,
      case
        when (fm.home_player_id = p_player_id and fm.home_score > fm.away_score)
             or (fm.away_player_id = p_player_id and fm.away_score > fm.home_score) then 'W'
        when fm.home_score = fm.away_score                                          then 'D'
        else 'L'
      end                                                   as result,
      (case when fm.home_player_id = p_player_id
            then fm.home_score else fm.away_score end)::int as goals_for,
      (case when fm.home_player_id = p_player_id
            then fm.away_score else fm.home_score end)::int as goals_against,
      fm.confirmed_at                                       as played_at,
      'friendly'::text                                      as match_type
    from friendly_matches fm
    where (fm.home_player_id = p_player_id or fm.away_player_id = p_player_id)
      and fm.status in ('confirmed', 'final')
      and fm.home_score is not null

    union all

    select
      cm.id,
      case when cm.home_player_id = p_player_id
           then cm.away_player_id
           else cm.home_player_id end,
      case
        when (cm.home_player_id = p_player_id and cm.home_score > cm.away_score)
             or (cm.away_player_id = p_player_id and cm.away_score > cm.home_score) then 'W'
        when cm.home_score = cm.away_score                                           then 'D'
        else 'L'
      end,
      (case when cm.home_player_id = p_player_id
            then cm.home_score else cm.away_score end)::int,
      (case when cm.home_player_id = p_player_id
            then cm.away_score else cm.home_score end)::int,
      coalesce(cm.played_at, cm.confirmed_at),
      'championship'::text
    from championship_matches cm
    where (cm.home_player_id = p_player_id or cm.away_player_id = p_player_id)
      and cm.status in ('confirmed', 'final')
      and cm.home_score is not null

    order by played_at desc nulls last
    limit p_limit
  )
  select
    m.match_id,
    m.opponent_id,
    u.name   as opponent_name,
    m.result,
    m.goals_for,
    m.goals_against,
    m.played_at,
    m.match_type
  from matches m
  join users u on u.id = m.opponent_id;
$$;


create or replace function get_h2h_stats(p_player1_id uuid, p_player2_id uuid)
returns table (
  player1_wins  bigint,
  player2_wins  bigint,
  draws         bigint,
  player1_goals bigint,
  player2_goals bigint,
  total_matches bigint
)
language sql
security definer
set search_path = public
as $$
  select
    count(*) filter (where
      (home_player_id = p_player1_id and home_score > away_score)
      or (away_player_id = p_player1_id and away_score > home_score)
    )                                                                           as player1_wins,
    count(*) filter (where
      (home_player_id = p_player2_id and home_score > away_score)
      or (away_player_id = p_player2_id and away_score > home_score)
    )                                                                           as player2_wins,
    count(*) filter (where home_score = away_score)                            as draws,
    coalesce(sum(case
      when home_player_id = p_player1_id then home_score::bigint
      else away_score::bigint
    end), 0)                                                                    as player1_goals,
    coalesce(sum(case
      when home_player_id = p_player2_id then home_score::bigint
      else away_score::bigint
    end), 0)                                                                    as player2_goals,
    count(*)                                                                    as total_matches
  from (
    select home_player_id, away_player_id, home_score, away_score
    from friendly_matches
    where status in ('confirmed', 'final')
      and home_score is not null
      and (
        (home_player_id = p_player1_id and away_player_id = p_player2_id)
        or (home_player_id = p_player2_id and away_player_id = p_player1_id)
      )
    union all
    select home_player_id, away_player_id, home_score, away_score
    from championship_matches
    where status in ('confirmed', 'final')
      and home_score is not null
      and (
        (home_player_id = p_player1_id and away_player_id = p_player2_id)
        or (home_player_id = p_player2_id and away_player_id = p_player1_id)
      )
  ) m;
$$;


-- ──────────────────────────────────────────────────────────────
-- ADMIN ACTIVITY LOG
-- Append-only audit trail. No RLS — service role only.
-- ──────────────────────────────────────────────────────────────
create table if not exists admin_activity_log (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references users(id) on delete restrict,
  action       text not null,
  entity_type  text not null,  -- 'player' | 'match' | 'championship' | 'badge' | 'settings'
  entity_id    text,
  details      jsonb,
  created_at   timestamptz not null default now()
);

create index idx_aal_created on admin_activity_log(created_at desc);
create index idx_aal_entity  on admin_activity_log(entity_type, entity_id);
create index idx_aal_admin   on admin_activity_log(admin_id);


-- ──────────────────────────────────────────────────────────────
-- SYSTEM SETTINGS (key-value store for admin-configurable values)
-- ──────────────────────────────────────────────────────────────
create table if not exists system_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references users(id) on delete set null
);

-- Seed defaults (idempotent)
insert into system_settings (key, value) values
  ('gameplay_rules', '""')
on conflict (key) do nothing;
