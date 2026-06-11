-- ============================================================
-- iSport — get_player_form championship-date ordering fix
-- Apply AFTER: schema_form_order_patch.sql
--
-- Problem: all matches in a championship share the same played_at
-- stamp (set at match creation from the championship's date), but
-- confirmed_at on individual matches can be recent even for old
-- championships. Neither column alone reliably orders across
-- championships.
--
-- Fix: join championships and order by coalesce(c.played_at, c.created_at)
-- so every match in a championship is anchored to the championship's
-- own date. June-09 championship matches always sort above June-07,
-- June-03, March-03, regardless of when individual matches were confirmed.
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
      'championship'::text
    from championship_matches cm
    join championships c on c.id = cm.championship_id
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
  join users u on u.id = m.opponent_id
  order by m.played_at desc nulls last;
$$;
