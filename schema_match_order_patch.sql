-- ============================================================
-- iSport — get_player_form: exact match-recording-time tiebreak
-- Apply AFTER: schema_form_order_fix2.sql
--
-- Problem: schema_form_order_fix2.sql orders championship matches by
-- coalesce(c.played_at, c.created_at) — the CHAMPIONSHIP's date, not the
-- individual match's. Every match generated in the same championship batch
-- shares that exact timestamp (see insertMatchesWithOdds in
-- app/championships/actions.ts, which stamps cm.played_at with the
-- championship's date at noon UTC for every fixture at once). So within one
-- championship every match ties on played_at, and the app has no way to
-- tell which one actually happened most recently — confirmed by RPC: a
-- player's "last 5 results" all came back with the identical played_at
-- value, in an order that just reflects incidental row order, not reality.
-- This is what feeds the "LAST MATCH" card on player profiles, the AI
-- interviewer's "last 5 results (most recent first)" context (both read
-- this RPC directly), and (indirectly, see getChampionshipMatchHistoryRecord
-- in lib/stats/queries.ts) the P4P Recent Form pillar.
--
-- Fix: cm.confirmed_at is already the exact timestamp the score was
-- recorded (set once, in recordChampionshipScoreAction / the admin match
-- actions, and never touched again on later edits) — it just wasn't being
-- used. Keep played_at as the primary sort key (preserves fix2's intent:
-- an old championship backfilled today doesn't jump to the top just
-- because it was entered recently), and add confirmed_at as a tiebreaker
-- so matches within the same championship sort in the order their scores
-- were actually recorded.
-- ============================================================

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
      fm.confirmed_at                                       as recorded_at,
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
      coalesce(c.played_at::timestamptz, c.created_at),
      cm.confirmed_at,
      'championship'::text
    from championship_matches cm
    join championships c on c.id = cm.championship_id
    where (cm.home_player_id = p_player_id or cm.away_player_id = p_player_id)
      and cm.status in ('confirmed', 'final')
      and cm.home_score is not null

    order by played_at desc nulls last, recorded_at desc nulls last
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
  join users u on u.id = m.opponent_id
  order by m.played_at desc nulls last, m.recorded_at desc nulls last;
$$;
