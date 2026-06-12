-- ============================================================
-- iSport — Betting System Schema
-- Target: Supabase (PostgreSQL)
-- Apply AFTER: schema.sql (requires users, players, friendly_matches,
--              championships, championship_matches tables)
--
-- Rake model: 10% of NET PROFIT only (stake always returned on win).
--   potential_winnings = bet_amount * combined_odds
--   rake               = (potential_winnings - bet_amount) * 0.10
--   actual_winnings    = bet_amount + (potential_winnings - bet_amount) * 0.90
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- ENUMS
-- ──────────────────────────────────────────────────────────────
create type market_type as enum (
  '1X2',
  'OU2_5',       -- Over/Under 2.5
  'HANDICAP',    -- Handicap +1.5
  'BTTS',        -- Both Teams To Score
  'EXACT_SCORE',
  'CUSTOM_PROP'
);

create type market_status as enum (
  'OPEN',        -- accepting bets
  'LOCKED',      -- admin locked; no new bets
  'SETTLED',
  'CANCELLED'
);

create type bet_type as enum ('SINGLE', 'PARLAY');

create type bet_status as enum (
  'PENDING',
  'WON',
  'LOST',
  'RETURNED',    -- void/push, stake returned
  'CANCELLED'
);

create type leg_result as enum ('PENDING', 'WON', 'LOST', 'RETURNED');

create type match_ref_type as enum ('friendly', 'championship');


-- ──────────────────────────────────────────────────────────────
-- 1. PLAYER BALANCES
-- ──────────────────────────────────────────────────────────────
create table player_balances (
  player_id        uuid primary key references users(id) on delete cascade,
  current_balance  numeric(12,2) not null default 10000.00
                     check (current_balance >= 0),
  initial_balance  numeric(12,2) not null default 10000.00,
  -- Running total of rake taken from this player's winnings (admin earnings)
  total_rake_paid  numeric(12,2) not null default 0.00,
  last_updated     timestamptz   not null default now()
);

-- Auto-create a balance row whenever a new user is created
create or replace function fn_init_player_balance()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into player_balances (player_id) values (new.id)
  on conflict (player_id) do nothing;
  return new;
end;
$$;

create trigger trg_init_player_balance
  after insert on users
  for each row execute function fn_init_player_balance();


-- ──────────────────────────────────────────────────────────────
-- 2. BET MARKETS
-- ──────────────────────────────────────────────────────────────
create table bet_markets (
  market_id           uuid primary key default gen_random_uuid(),
  match_id            uuid          not null,
  match_type          match_ref_type not null,
  market_type         market_type   not null,

  -- Options: { "option1": {"key":"home","label":"Team A"},
  --            "option2": {"key":"draw","label":"Draw"},
  --            "option3": {"key":"away","label":"Team B"} }
  -- Markets may define option4+ (for example Exact Score).
  options             jsonb         not null,

  -- Current live odds: { "option1": 1.85, "option2": 3.20, "option3": 1.95 }
  odds                jsonb         not null,

  -- AI-suggested odds (stored for audit; may differ from live odds)
  ai_calculated_odds  jsonb,

  -- true = admin manually overrode ai odds
  admin_override      boolean       not null default false,

  status              market_status not null default 'OPEN',

  -- Which option key won (set when settled): option1, option2, option3...
  result              text          check (result is null or result ~ '^option[0-9]+$'),

  created_by          uuid          not null references users(id) on delete restrict,
  created_at          timestamptz   not null default now(),
  locked_at           timestamptz,
  unlocked_at         timestamptz,
  settled_at          timestamptz,
  settled_by          uuid          references users(id) on delete restrict,

  constraint chk_market_options_keys check (
    options ? 'option1' and options ? 'option2'
  ),
  constraint chk_market_odds_keys check (
    odds ? 'option1' and odds ? 'option2'
  ),
  -- A market can only be on one match
  constraint uq_market_match_type unique (match_id, match_type, market_type)
    deferrable initially deferred
);

-- Allow multiple CUSTOM_PROP markets per match (override the unique constraint)
create unique index uq_market_match_type_standard
  on bet_markets (match_id, match_type, market_type)
  where market_type != 'CUSTOM_PROP';

-- Drop the table-level constraint (it conflicts with the partial index approach)
alter table bet_markets drop constraint if exists uq_market_match_type;


-- ──────────────────────────────────────────────────────────────
-- 3. BETS
-- ──────────────────────────────────────────────────────────────
create table bets (
  bet_id               uuid primary key default gen_random_uuid(),
  player_id            uuid          not null references users(id) on delete restrict,
  bet_type             bet_type      not null,

  -- For SINGLE bets: the market being bet on
  market_id            uuid          references bet_markets(market_id) on delete restrict,
  -- For SINGLE bets: option1, option2, option3...
  selected_option      text          check (selected_option is null or selected_option ~ '^option[0-9]+$'),
  -- Odds snapshot at time of placement (single bet)
  odds_at_placement    numeric(8,4),

  bet_amount           numeric(12,2) not null check (bet_amount > 0),

  -- Combined odds (= odds_at_placement for single; = product of leg odds for parlay)
  combined_odds        numeric(10,4) not null check (combined_odds > 1),

  -- Calculated fields (stored for fast reads)
  potential_winnings   numeric(12,2) not null,  -- bet_amount * combined_odds
  rake_amount          numeric(12,2) not null default 0, -- 10% of profit
  actual_winnings      numeric(12,2) not null,  -- potential_winnings - rake_amount

  status               bet_status    not null default 'PENDING',

  placed_at            timestamptz   not null default now(),
  settled_at           timestamptz,
  settled_by           uuid          references users(id) on delete restrict,
  admin_notes          text,

  -- Immutability guard: once settled, the row is frozen (enforced by trigger)
  is_settled           boolean       not null generated always as (
                          status in ('WON','LOST','RETURNED','CANCELLED')
                        ) stored,

  constraint chk_single_has_market check (
    bet_type != 'SINGLE' or (market_id is not null and selected_option is not null)
  ),
  constraint chk_parlay_no_direct_market check (
    bet_type != 'PARLAY' or (market_id is null and selected_option is null)
  )
);


-- ──────────────────────────────────────────────────────────────
-- 4. PARLAY LEGS
-- ──────────────────────────────────────────────────────────────
create table parlay_legs (
  leg_id             uuid primary key default gen_random_uuid(),
  bet_id             uuid          not null references bets(bet_id) on delete cascade,
  leg_order          smallint      not null check (leg_order >= 1),
  market_id          uuid          not null references bet_markets(market_id) on delete restrict,
  selected_option    text          not null check (selected_option ~ '^option[0-9]+$'),
  odds_at_placement  numeric(8,4)  not null check (odds_at_placement > 1),
  result             leg_result    not null default 'PENDING',
  settled_at         timestamptz,

  unique (bet_id, leg_order),
  unique (bet_id, market_id)  -- one selection per market per parlay
);


-- ──────────────────────────────────────────────────────────────
-- 5. CUSTOM PROPS  (admin-created special markets)
-- ──────────────────────────────────────────────────────────────
-- Custom props create a row in bet_markets with type CUSTOM_PROP.
-- This table stores the additional description/metadata.
create table custom_props (
  prop_id      uuid primary key default gen_random_uuid(),
  market_id    uuid not null unique references bet_markets(market_id) on delete cascade,
  match_id     uuid not null,
  match_type   match_ref_type not null,
  description  text not null,
  created_by   uuid not null references users(id) on delete restrict,
  created_at   timestamptz not null default now()
);


-- ──────────────────────────────────────────────────────────────
-- 6. ADMIN RAKE LEDGER  (per-bet rake accounting)
-- ──────────────────────────────────────────────────────────────
create table admin_rake_ledger (
  ledger_id     uuid primary key default gen_random_uuid(),
  bet_id        uuid not null references bets(bet_id) on delete restrict,
  player_id     uuid not null references users(id) on delete restrict,
  rake_amount   numeric(12,2) not null check (rake_amount >= 0),
  collected_at  timestamptz not null default now()
);


-- ──────────────────────────────────────────────────────────────
-- 7. BET HISTORY ARCHIVE  (full JSON snapshot of settled bets)
-- ──────────────────────────────────────────────────────────────
create table bet_history_archive (
  archive_id   uuid primary key default gen_random_uuid(),
  bet_id       uuid not null,               -- not FK — archive survives bet deletion
  player_id    uuid not null,
  archived_at  timestamptz not null default now(),
  reason       text not null,               -- 'settled', 'cancelled', 'admin_override'
  snapshot     jsonb not null               -- full denormalized copy of bet + legs
);


-- ──────────────────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────────────────
-- Bet history / activity feed
create index idx_bets_player_status    on bets (player_id, status);
create index idx_bets_player_placed    on bets (player_id, placed_at desc);
create index idx_bets_settled_at       on bets (settled_at desc) where settled_at is not null;
create index idx_bets_status           on bets (status) where status = 'PENDING';

-- Market lookups
create index idx_markets_match         on bet_markets (match_id, match_type);
create index idx_markets_status        on bet_markets (status) where status = 'OPEN';

-- Parlay legs
create index idx_parlay_legs_bet       on parlay_legs (bet_id);
create index idx_parlay_legs_market    on parlay_legs (market_id);

-- Archive
create index idx_archive_player        on bet_history_archive (player_id, archived_at desc);
create index idx_archive_bet           on bet_history_archive (bet_id);

-- Rake ledger
create index idx_rake_player           on admin_rake_ledger (player_id);
create index idx_rake_bet              on admin_rake_ledger (bet_id);


-- ──────────────────────────────────────────────────────────────
-- IMMUTABILITY TRIGGER
-- Prevent edits to settled/cancelled bets (except by admin via
-- the settle_bet function which uses security definer)
-- ──────────────────────────────────────────────────────────────
create or replace function fn_prevent_bet_mutation()
returns trigger language plpgsql as $$
begin
  if old.is_settled then
    raise exception 'Bet % is already settled and cannot be modified.', old.bet_id;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_bet_mutation
  before update on bets
  for each row execute function fn_prevent_bet_mutation();


-- ──────────────────────────────────────────────────────────────
-- FUNCTION: place_bet
-- Atomically validates + places a single or parlay bet.
-- Parameters:
--   p_player_id       — betting player
--   p_bet_type        — 'SINGLE' | 'PARLAY'
--   p_bet_amount      — stake in AMD
--   p_market_id       — for SINGLE only (null for PARLAY)
--   p_selected_option — for SINGLE only (null for PARLAY)
--   p_legs            — for PARLAY: [{market_id, selected_option}]
--
-- Returns: new bet_id
-- ──────────────────────────────────────────────────────────────
create or replace function place_bet(
  p_player_id       uuid,
  p_bet_type        text,
  p_bet_amount      numeric,
  p_market_id       uuid    default null,
  p_selected_option text    default null,
  p_legs            jsonb   default null   -- [{market_id, selected_option}]
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_bet_id          uuid;
  v_combined_odds   numeric := 1.0;
  v_odds_snapshot   numeric;
  v_balance         numeric;
  v_potential       numeric;
  v_rake            numeric;
  v_actual          numeric;
  v_leg             jsonb;
  v_leg_order       smallint := 1;
  v_market          bet_markets%rowtype;
  v_market_odds     jsonb;
begin
  -- ── Validate bet amount
  if p_bet_amount <= 0 then
    raise exception 'Bet amount must be positive.';
  end if;

  -- ── Check player balance
  select current_balance into v_balance
  from player_balances
  where player_id = p_player_id
  for update;

  if not found then
    raise exception 'Player balance record not found for %.', p_player_id;
  end if;

  if v_balance < p_bet_amount then
    raise exception 'Insufficient balance. Available: %, required: %.', v_balance, p_bet_amount;
  end if;

  -- ── Compute combined odds
  if p_bet_type = 'SINGLE' then
    select * into v_market from bet_markets where market_id = p_market_id;
    if not found then
      raise exception 'Market % not found.', p_market_id;
    end if;
    if v_market.status != 'OPEN' then
      raise exception 'Market % is not open for betting (status: %).', p_market_id, v_market.status;
    end if;
    v_odds_snapshot := (v_market.odds ->> p_selected_option)::numeric;
    if v_odds_snapshot is null then
      raise exception 'Invalid option "%" for market %.', p_selected_option, p_market_id;
    end if;
    v_combined_odds := v_odds_snapshot;

  elsif p_bet_type = 'PARLAY' then
    if p_legs is null or jsonb_array_length(p_legs) < 2 then
      raise exception 'Parlay requires at least 2 legs.';
    end if;
    for v_leg in select * from jsonb_array_elements(p_legs) loop
      select * into v_market
      from bet_markets
      where market_id = (v_leg->>'market_id')::uuid;

      if not found then
        raise exception 'Market % not found.', v_leg->>'market_id';
      end if;
      if v_market.status != 'OPEN' then
        raise exception 'Market % is locked or not open.', v_leg->>'market_id';
      end if;

      v_odds_snapshot := (v_market.odds ->> (v_leg->>'selected_option'))::numeric;
      if v_odds_snapshot is null then
        raise exception 'Invalid option "%" for market %.', v_leg->>'selected_option', v_leg->>'market_id';
      end if;
      v_combined_odds := v_combined_odds * v_odds_snapshot;
    end loop;

  else
    raise exception 'Invalid bet_type "%". Must be SINGLE or PARLAY.', p_bet_type;
  end if;

  -- ── Calculate financials
  v_potential := round(p_bet_amount * v_combined_odds, 2);
  v_rake      := round((v_potential - p_bet_amount) * 0.10, 2);
  v_actual    := v_potential - v_rake;

  -- ── Deduct balance
  update player_balances
  set current_balance = current_balance - p_bet_amount,
      last_updated    = now()
  where player_id = p_player_id;

  -- ── Insert bet
  insert into bets (
    player_id, bet_type, market_id, selected_option, odds_at_placement,
    bet_amount, combined_odds, potential_winnings, rake_amount, actual_winnings
  ) values (
    p_player_id,
    p_bet_type::bet_type,
    case when p_bet_type = 'SINGLE' then p_market_id end,
    case when p_bet_type = 'SINGLE' then p_selected_option end,
    case when p_bet_type = 'SINGLE' then v_combined_odds end,
    p_bet_amount,
    v_combined_odds,
    v_potential,
    v_rake,
    v_actual
  )
  returning bet_id into v_bet_id;

  -- ── Insert parlay legs
  if p_bet_type = 'PARLAY' then
    for v_leg in select * from jsonb_array_elements(p_legs) loop
      select odds into v_market_odds
      from bet_markets where market_id = (v_leg->>'market_id')::uuid;

      insert into parlay_legs (
        bet_id, leg_order, market_id, selected_option, odds_at_placement
      ) values (
        v_bet_id,
        v_leg_order,
        (v_leg->>'market_id')::uuid,
        v_leg->>'selected_option',
        (v_market_odds ->> (v_leg->>'selected_option'))::numeric
      );
      v_leg_order := v_leg_order + 1;
    end loop;
  end if;

  return v_bet_id;
end;
$$;


-- ──────────────────────────────────────────────────────────────
-- FUNCTION: settle_bet
-- Called by admin to resolve a bet.
-- Parameters:
--   p_bet_id     — bet to settle
--   p_outcome    — 'WON' | 'LOST' | 'RETURNED' | 'CANCELLED'
--   p_admin_id   — admin performing the action
--   p_notes      — optional admin note
--
-- On WON:  credits actual_winnings to player, logs rake
-- On LOST: nothing (stake already deducted at placement)
-- On RETURNED/CANCELLED: refunds bet_amount
-- Archives a snapshot of the bet.
-- ──────────────────────────────────────────────────────────────
create or replace function settle_bet(
  p_bet_id   uuid,
  p_outcome  text,
  p_admin_id uuid,
  p_notes    text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_bet bets%rowtype;
begin
  select * into v_bet from bets where bet_id = p_bet_id for update;
  if not found then
    raise exception 'Bet % not found.', p_bet_id;
  end if;
  if v_bet.is_settled then
    raise exception 'Bet % is already settled.', p_bet_id;
  end if;
  if p_outcome not in ('WON','LOST','RETURNED','CANCELLED') then
    raise exception 'Invalid outcome "%".', p_outcome;
  end if;

  -- ── Disable immutability trigger for this admin operation
  set local session_replication_role = replica;

  -- ── Update bet status
  update bets
  set status      = p_outcome::bet_status,
      settled_at  = now(),
      settled_by  = p_admin_id,
      admin_notes = p_notes
  where bet_id = p_bet_id;

  -- ── Credit player
  if p_outcome = 'WON' then
    update player_balances
    set current_balance = current_balance + v_bet.actual_winnings,
        total_rake_paid = total_rake_paid + v_bet.rake_amount,
        last_updated    = now()
    where player_id = v_bet.player_id;

    insert into admin_rake_ledger (bet_id, player_id, rake_amount)
    values (p_bet_id, v_bet.player_id, v_bet.rake_amount);

  elsif p_outcome in ('RETURNED','CANCELLED') then
    -- Refund the stake
    update player_balances
    set current_balance = current_balance + v_bet.bet_amount,
        last_updated    = now()
    where player_id = v_bet.player_id;
  end if;

  -- ── Archive snapshot
  insert into bet_history_archive (bet_id, player_id, reason, snapshot)
  select
    v_bet.bet_id,
    v_bet.player_id,
    lower(p_outcome),
    jsonb_build_object(
      'bet',  row_to_json(v_bet),
      'legs', coalesce(
        (select jsonb_agg(row_to_json(pl))
         from parlay_legs pl where pl.bet_id = p_bet_id),
        '[]'::jsonb
      )
    );

  set local session_replication_role = default;
end;
$$;


-- ──────────────────────────────────────────────────────────────
-- FUNCTION: settle_market
-- Settles all PENDING bets on a market in one call.
-- Admin passes the winning option key (option1, option2, option3...).
-- ──────────────────────────────────────────────────────────────
create or replace function settle_market(
  p_market_id      uuid,
  p_winning_option text,
  p_admin_id       uuid
)
returns int   -- number of bets settled
language plpgsql security definer
set search_path = public
as $$
declare
  v_bet_id   uuid;
  v_outcome  text;
  v_count    int := 0;
  v_leg      parlay_legs%rowtype;
begin
  if p_winning_option is null or p_winning_option !~ '^option[0-9]+$' then
    raise exception 'Invalid winning option "%".', p_winning_option;
  end if;

  if not exists (
    select 1
    from bet_markets
    where market_id = p_market_id
      and options ? p_winning_option
  ) then
    raise exception 'Option "%" does not exist for market %.', p_winning_option, p_market_id;
  end if;

  -- Mark market settled
  update bet_markets
  set status     = 'SETTLED',
      result     = p_winning_option,
      settled_at = now(),
      settled_by = p_admin_id
  where market_id = p_market_id;

  -- Update parlay leg results for this market
  update parlay_legs
  set result     = case when selected_option = p_winning_option then 'WON' else 'LOST' end,
      settled_at = now()
  where market_id = p_market_id;

  -- Settle SINGLE bets on this market
  for v_bet_id in
    select bet_id from bets
    where market_id = p_market_id
      and bet_type  = 'SINGLE'
      and status    = 'PENDING'
  loop
    select case when selected_option = p_winning_option then 'WON' else 'LOST' end
    into v_outcome
    from bets where bet_id = v_bet_id;

    perform settle_bet(v_bet_id, v_outcome, p_admin_id, 'Auto-settled via settle_market');
    v_count := v_count + 1;
  end loop;

  -- Check PARLAY bets: if all legs are now settled, resolve the parlay
  for v_bet_id in
    select distinct pl.bet_id
    from parlay_legs pl
    join bets b on b.bet_id = pl.bet_id
    where pl.market_id = p_market_id
      and b.status     = 'PENDING'
      and b.bet_type   = 'PARLAY'
  loop
    -- Parlay WON only if every leg WON; LOST if any leg LOST;
    -- still PENDING if any leg is still PENDING
    select
      case
        when exists (select 1 from parlay_legs where bet_id = v_bet_id and result = 'PENDING') then null
        when exists (select 1 from parlay_legs where bet_id = v_bet_id and result = 'LOST')    then 'LOST'
        when not exists (select 1 from parlay_legs where bet_id = v_bet_id and result != 'WON') then 'WON'
        else 'RETURNED'  -- mixed WON/RETURNED legs
      end
    into v_outcome;

    if v_outcome is not null then
      perform settle_bet(v_bet_id, v_outcome, p_admin_id, 'Auto-settled via settle_market');
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;


-- ──────────────────────────────────────────────────────────────
-- RLS POLICIES
-- ──────────────────────────────────────────────────────────────
alter table player_balances     enable row level security;
alter table bet_markets         enable row level security;
alter table bets                enable row level security;
alter table parlay_legs         enable row level security;
alter table custom_props        enable row level security;
alter table admin_rake_ledger   enable row level security;
alter table bet_history_archive enable row level security;

-- player_balances: own row only (admins see all via service role)
create policy "player see own balance"
  on player_balances for select
  using (player_id = auth.uid());

create policy "player update own balance via functions"
  on player_balances for update
  using (false);  -- only security-definer functions may write

-- bet_markets: everyone can read open markets; admin manages via service role
create policy "anyone reads markets"
  on bet_markets for select
  using (true);

-- bets: players see only their own bets
create policy "player sees own bets"
  on bets for select
  using (player_id = auth.uid());

-- bets INSERT via place_bet function (security definer), not directly
create policy "no direct bet insert"
  on bets for insert
  with check (false);

-- parlay_legs: readable by the bet owner
create policy "player sees own parlay legs"
  on parlay_legs for select
  using (
    exists (select 1 from bets b where b.bet_id = parlay_legs.bet_id and b.player_id = auth.uid())
  );

-- custom_props: everyone reads
create policy "anyone reads custom props"
  on custom_props for select
  using (true);

-- admin_rake_ledger: admin only (via service role)
create policy "no direct rake read"
  on admin_rake_ledger for select
  using (false);

-- bet_history_archive: admin only (via service role)
create policy "no direct archive read"
  on bet_history_archive for select
  using (false);


-- ──────────────────────────────────────────────────────────────
-- REALTIME
-- ──────────────────────────────────────────────────────────────
alter publication supabase_realtime
  add table player_balances, bet_markets, bets;
