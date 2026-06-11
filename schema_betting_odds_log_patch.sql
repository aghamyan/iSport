-- ============================================================
-- iSport — Odds Calculation Log
-- Apply AFTER: schema_betting.sql
--
-- Stores every AI odds calculation run with full inputs + outputs
-- so admin can audit, compare AI vs overridden odds, and tune the
-- algorithm over time.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- ODDS CALCULATION LOG
-- One row per calculateFullMarkets() call.
-- ──────────────────────────────────────────────────────────────
create table odds_calculation_log (
  log_id            uuid primary key default gen_random_uuid(),
  match_id          uuid          not null,
  match_type        match_ref_type not null,
  home_player_id    uuid          not null references users(id) on delete restrict,
  away_player_id    uuid          not null references users(id) on delete restrict,

  -- Full input bundle: stats, form, h2h, league avg
  inputs            jsonb         not null,

  -- Full output from calculateFullMarkets(): all markets + confidence
  full_odds_output  jsonb         not null,

  -- Extracted for easy querying/filtering
  confidence_score  numeric(5,2)  not null check (confidence_score between 0 and 100),
  confidence_label  text          not null check (confidence_label in ('low','medium','high')),

  -- Which admin triggered the calculation
  created_by        uuid          not null references users(id) on delete restrict,
  created_at        timestamptz   not null default now()
);

-- Indexes for common admin queries
create index idx_odds_log_match      on odds_calculation_log (match_id, match_type);
create index idx_odds_log_players    on odds_calculation_log (home_player_id, away_player_id);
create index idx_odds_log_created    on odds_calculation_log (created_at desc);
create index idx_odds_log_confidence on odds_calculation_log (confidence_score);

-- Only admins can read via service role; no direct RLS access for players
alter table odds_calculation_log enable row level security;

create policy "no direct read"
  on odds_calculation_log for select
  using (false);


-- ──────────────────────────────────────────────────────────────
-- FUNCTION: get_odds_calculation_summary
-- Returns the most recent calculation for each active match,
-- with confidence scores. Used on the admin dashboard.
-- ──────────────────────────────────────────────────────────────
create or replace function get_odds_calculation_summary()
returns table (
  log_id           uuid,
  match_id         uuid,
  match_type       text,
  home_player_name text,
  away_player_name text,
  confidence_score numeric,
  confidence_label text,
  markets_count    bigint,
  calculated_at    timestamptz
)
language sql security definer
set search_path = public
as $$
  select distinct on (ocl.match_id, ocl.match_type)
    ocl.log_id,
    ocl.match_id,
    ocl.match_type::text,
    u1.name as home_player_name,
    u2.name as away_player_name,
    ocl.confidence_score,
    ocl.confidence_label,
    (
      select count(*)
      from bet_markets bm
      where bm.match_id   = ocl.match_id
        and bm.match_type = ocl.match_type
        and bm.status not in ('CANCELLED', 'SETTLED')
    ) as markets_count,
    ocl.created_at as calculated_at
  from odds_calculation_log ocl
  join users u1 on u1.id = ocl.home_player_id
  join users u2 on u2.id = ocl.away_player_id
  order by ocl.match_id, ocl.match_type, ocl.created_at desc;
$$;


-- ──────────────────────────────────────────────────────────────
-- FUNCTION: get_market_override_stats
-- Returns how many markets are AI vs admin-overridden.
-- Useful for the admin dashboard.
-- ──────────────────────────────────────────────────────────────
create or replace function get_market_override_stats()
returns table (
  total_markets     bigint,
  ai_markets        bigint,
  overridden_markets bigint,
  override_pct      numeric
)
language sql security definer
set search_path = public
as $$
  select
    count(*)                                     as total_markets,
    count(*) filter (where not admin_override)   as ai_markets,
    count(*) filter (where admin_override)       as overridden_markets,
    round(
      count(*) filter (where admin_override)::numeric
      / nullif(count(*), 0) * 100, 1
    )                                            as override_pct
  from bet_markets
  where status not in ('CANCELLED', 'SETTLED');
$$;
