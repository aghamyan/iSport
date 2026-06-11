-- ============================================================
-- iSport — Balance & Transaction System Patch
-- Apply AFTER: schema_betting.sql
--
-- Adds:
--   • tx_type enum
--   • balance_transactions table (full audit log)
--   • Replaces place_bet()  → now writes a BET_PLACED tx row
--   • Replaces settle_bet() → now writes BET_WON / BET_RETURNED / BET_CANCELLED tx row
--   • admin_adjust_balance()  — manual credit/debit with reason
--   • admin_reset_balance()   — set a player to a specific amount
--   • admin_bulk_reset()      — reset every player at once
--   • get_balance_stats()     — house analytics
--   • Initialises player_balances for any existing users missing a row
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- ENUM
-- ──────────────────────────────────────────────────────────────
create type tx_type as enum (
  'BET_PLACED',    -- debit: stake taken when bet is placed
  'BET_WON',       -- credit: actual_winnings paid (stake + profit - rake)
  'BET_RETURNED',  -- credit: full stake returned on void/push
  'BET_CANCELLED', -- credit: full stake returned on cancellation
  'ADMIN_CREDIT',  -- credit: admin manually adds funds
  'ADMIN_DEBIT',   -- debit: admin manually removes funds
  'ADMIN_RESET'    -- neutral: admin resets balance to a specific value
);


-- ──────────────────────────────────────────────────────────────
-- BALANCE TRANSACTIONS
-- Every balance change is recorded here — immutable once written.
-- ──────────────────────────────────────────────────────────────
create table balance_transactions (
  tx_id          uuid primary key default gen_random_uuid(),
  player_id      uuid          not null references users(id) on delete restrict,
  tx_type        tx_type       not null,
  -- Signed: positive = credit to player, negative = debit from player
  amount         numeric(12,2) not null,
  balance_before numeric(12,2) not null,
  balance_after  numeric(12,2) not null check (balance_after >= 0),
  -- For bet-related rows this is the bet_id; for admin rows it is null
  reference_id   uuid,
  description    text          not null,
  -- null = system/function; uuid = admin who triggered it
  created_by     uuid          references users(id) on delete set null,
  created_at     timestamptz   not null default now()
);

-- Prevent any UPDATE or DELETE — transactions are append-only
create or replace function fn_lock_transaction()
returns trigger language plpgsql as $$
begin
  raise exception 'balance_transactions rows are immutable.';
end;
$$;

create trigger trg_lock_transaction
  before update or delete on balance_transactions
  for each row execute function fn_lock_transaction();

-- Indexes
create index idx_btx_player_time  on balance_transactions (player_id, created_at desc);
create index idx_btx_ref          on balance_transactions (reference_id) where reference_id is not null;
create index idx_btx_type         on balance_transactions (tx_type);

-- RLS: players read only their own history
alter table balance_transactions enable row level security;

create policy "player reads own transactions"
  on balance_transactions for select
  using (player_id = auth.uid());

create policy "no direct insert"
  on balance_transactions for insert
  with check (false);


-- ──────────────────────────────────────────────────────────────
-- BACKFILL: create balance rows for existing users
-- ──────────────────────────────────────────────────────────────
insert into player_balances (player_id)
select id from users
where not exists (
  select 1 from player_balances pb where pb.player_id = users.id
);


-- ──────────────────────────────────────────────────────────────
-- REPLACE: place_bet  (adds transaction logging)
-- ──────────────────────────────────────────────────────────────
create or replace function place_bet(
  p_player_id       uuid,
  p_bet_type        text,
  p_bet_amount      numeric,
  p_market_id       uuid    default null,
  p_selected_option text    default null,
  p_legs            jsonb   default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_bet_id          uuid;
  v_combined_odds   numeric := 1.0;
  v_odds_snapshot   numeric;
  v_balance_before  numeric;
  v_balance_after   numeric;
  v_potential       numeric;
  v_rake            numeric;
  v_actual          numeric;
  v_leg             jsonb;
  v_leg_order       smallint := 1;
  v_market          bet_markets%rowtype;
  v_market_odds     jsonb;
begin
  if p_bet_amount <= 0 then
    raise exception 'Bet amount must be positive.';
  end if;

  -- Lock and read balance
  select current_balance into v_balance_before
  from player_balances
  where player_id = p_player_id
  for update;

  if not found then
    raise exception 'Player balance record not found.';
  end if;

  if v_balance_before < p_bet_amount then
    raise exception 'Insufficient balance. Available: %, required: %.', v_balance_before, p_bet_amount;
  end if;

  -- Build combined odds
  if p_bet_type = 'SINGLE' then
    select * into v_market from bet_markets where market_id = p_market_id;
    if not found then raise exception 'Market % not found.', p_market_id; end if;
    if v_market.status != 'OPEN' then
      raise exception 'Market % is not open (status: %).', p_market_id, v_market.status;
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
      select * into v_market from bet_markets where market_id = (v_leg->>'market_id')::uuid;
      if not found then raise exception 'Market % not found.', v_leg->>'market_id'; end if;
      if v_market.status != 'OPEN' then
        raise exception 'Market % is not open.', v_leg->>'market_id';
      end if;
      v_odds_snapshot := (v_market.odds ->> (v_leg->>'selected_option'))::numeric;
      if v_odds_snapshot is null then
        raise exception 'Invalid option "%" for market %.', v_leg->>'selected_option', v_leg->>'market_id';
      end if;
      v_combined_odds := v_combined_odds * v_odds_snapshot;
    end loop;
  else
    raise exception 'Invalid bet_type "%".', p_bet_type;
  end if;

  -- Financials
  v_potential := round(p_bet_amount * v_combined_odds, 2);
  v_rake      := round((v_potential - p_bet_amount) * 0.10, 2);
  v_actual    := v_potential - v_rake;

  -- Deduct balance
  v_balance_after := v_balance_before - p_bet_amount;
  update player_balances
  set current_balance = v_balance_after,
      last_updated    = now()
  where player_id = p_player_id;

  -- Insert bet
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

  -- Parlay legs
  if p_bet_type = 'PARLAY' then
    for v_leg in select * from jsonb_array_elements(p_legs) loop
      select odds into v_market_odds from bet_markets where market_id = (v_leg->>'market_id')::uuid;
      insert into parlay_legs (bet_id, leg_order, market_id, selected_option, odds_at_placement)
      values (
        v_bet_id, v_leg_order,
        (v_leg->>'market_id')::uuid,
        v_leg->>'selected_option',
        (v_market_odds ->> (v_leg->>'selected_option'))::numeric
      );
      v_leg_order := v_leg_order + 1;
    end loop;
  end if;

  -- Log transaction
  insert into balance_transactions (
    player_id, tx_type, amount, balance_before, balance_after,
    reference_id, description
  ) values (
    p_player_id,
    'BET_PLACED',
    -p_bet_amount,
    v_balance_before,
    v_balance_after,
    v_bet_id,
    'Bet placed (' || p_bet_type || ', odds ' || round(v_combined_odds, 2) || '×)'
  );

  return v_bet_id;
end;
$$;


-- ──────────────────────────────────────────────────────────────
-- REPLACE: settle_bet  (adds transaction logging)
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
  v_bet            bets%rowtype;
  v_balance_before numeric;
  v_balance_after  numeric;
  v_credit         numeric;
  v_tx_type        tx_type;
  v_desc           text;
begin
  select * into v_bet from bets where bet_id = p_bet_id for update;
  if not found then raise exception 'Bet % not found.', p_bet_id; end if;
  if v_bet.is_settled then raise exception 'Bet % is already settled.', p_bet_id; end if;
  if p_outcome not in ('WON','LOST','RETURNED','CANCELLED') then
    raise exception 'Invalid outcome "%".', p_outcome;
  end if;

  set local session_replication_role = replica;

  -- Update bet
  update bets
  set status      = p_outcome::bet_status,
      settled_at  = now(),
      settled_by  = p_admin_id,
      admin_notes = p_notes
  where bet_id = p_bet_id;

  -- Credit balance where applicable
  if p_outcome in ('WON', 'RETURNED', 'CANCELLED') then
    v_credit := case p_outcome
      when 'WON'       then v_bet.actual_winnings
      else                  v_bet.bet_amount      -- return stake
    end;

    v_tx_type := case p_outcome
      when 'WON'       then 'BET_WON'
      when 'RETURNED'  then 'BET_RETURNED'
      else                  'BET_CANCELLED'
    end::tx_type;

    v_desc := case p_outcome
      when 'WON' then
        'Bet won — ' || v_bet.actual_winnings || ' AMD credited (rake: ' || v_bet.rake_amount || ' AMD)'
      when 'RETURNED' then 'Bet voided — stake returned'
      else                 'Bet cancelled — stake returned'
    end;

    select current_balance into v_balance_before
    from player_balances where player_id = v_bet.player_id for update;

    v_balance_after := v_balance_before + v_credit;

    update player_balances
    set current_balance = v_balance_after,
        total_rake_paid = total_rake_paid + case when p_outcome = 'WON' then v_bet.rake_amount else 0 end,
        last_updated    = now()
    where player_id = v_bet.player_id;

    insert into balance_transactions (
      player_id, tx_type, amount, balance_before, balance_after,
      reference_id, description, created_by
    ) values (
      v_bet.player_id, v_tx_type, v_credit,
      v_balance_before, v_balance_after,
      p_bet_id, v_desc, p_admin_id
    );

    -- Log rake
    if p_outcome = 'WON' then
      insert into admin_rake_ledger (bet_id, player_id, rake_amount)
      values (p_bet_id, v_bet.player_id, v_bet.rake_amount);
    end if;
  end if;

  -- Archive
  insert into bet_history_archive (bet_id, player_id, reason, snapshot)
  select v_bet.bet_id, v_bet.player_id, lower(p_outcome),
    jsonb_build_object(
      'bet',  row_to_json(v_bet),
      'legs', coalesce(
        (select jsonb_agg(row_to_json(pl)) from parlay_legs pl where pl.bet_id = p_bet_id),
        '[]'::jsonb
      )
    );

  set local session_replication_role = default;
end;
$$;


-- ──────────────────────────────────────────────────────────────
-- FUNCTION: admin_adjust_balance
-- Manual credit (positive amount) or debit (negative amount).
-- ──────────────────────────────────────────────────────────────
create or replace function admin_adjust_balance(
  p_player_id uuid,
  p_amount    numeric,   -- positive = add money, negative = remove money
  p_reason    text,
  p_admin_id  uuid
)
returns numeric  -- new balance
language plpgsql security definer
set search_path = public
as $$
declare
  v_before numeric;
  v_after  numeric;
  v_type   tx_type;
begin
  if p_amount = 0 then raise exception 'Adjustment amount cannot be zero.'; end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required for manual balance adjustments.';
  end if;

  select current_balance into v_before
  from player_balances where player_id = p_player_id for update;
  if not found then raise exception 'Player not found.'; end if;

  v_after := v_before + p_amount;
  if v_after < 0 then
    raise exception 'Adjustment would result in negative balance (current: %, adjustment: %).', v_before, p_amount;
  end if;

  v_type := case when p_amount > 0 then 'ADMIN_CREDIT' else 'ADMIN_DEBIT' end::tx_type;

  update player_balances
  set current_balance = v_after, last_updated = now()
  where player_id = p_player_id;

  insert into balance_transactions (
    player_id, tx_type, amount, balance_before, balance_after,
    description, created_by
  ) values (
    p_player_id, v_type, p_amount, v_before, v_after,
    'Admin adjustment: ' || p_reason, p_admin_id
  );

  return v_after;
end;
$$;


-- ──────────────────────────────────────────────────────────────
-- FUNCTION: admin_reset_balance
-- Set a player's balance to an exact target amount.
-- ──────────────────────────────────────────────────────────────
create or replace function admin_reset_balance(
  p_player_id uuid,
  p_target    numeric default 10000.00,
  p_admin_id  uuid    default null
)
returns numeric
language plpgsql security definer
set search_path = public
as $$
declare
  v_before numeric;
begin
  if p_target < 0 then raise exception 'Target balance cannot be negative.'; end if;

  select current_balance into v_before
  from player_balances where player_id = p_player_id for update;
  if not found then raise exception 'Player not found.'; end if;

  update player_balances
  set current_balance = p_target,
      last_updated    = now()
  where player_id = p_player_id;

  insert into balance_transactions (
    player_id, tx_type, amount, balance_before, balance_after,
    description, created_by
  ) values (
    p_player_id, 'ADMIN_RESET', p_target - v_before, v_before, p_target,
    'Admin reset balance to ' || p_target || ' AMD', p_admin_id
  );

  return p_target;
end;
$$;


-- ──────────────────────────────────────────────────────────────
-- FUNCTION: admin_bulk_reset
-- Reset ALL active players to p_target AMD.
-- Returns count of players affected.
-- ──────────────────────────────────────────────────────────────
create or replace function admin_bulk_reset(
  p_target   numeric default 10000.00,
  p_admin_id uuid    default null
)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_row    record;
  v_count  int := 0;
begin
  if p_target < 0 then raise exception 'Target balance cannot be negative.'; end if;

  for v_row in
    select pb.player_id, pb.current_balance
    from player_balances pb
    join users u on u.id = pb.player_id
    where u.is_active = true
    for update of pb
  loop
    update player_balances
    set current_balance = p_target, last_updated = now()
    where player_id = v_row.player_id;

    insert into balance_transactions (
      player_id, tx_type, amount, balance_before, balance_after,
      description, created_by
    ) values (
      v_row.player_id, 'ADMIN_RESET',
      p_target - v_row.current_balance,
      v_row.current_balance, p_target,
      'Bulk reset to ' || p_target || ' AMD', p_admin_id
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


-- ──────────────────────────────────────────────────────────────
-- FUNCTION: get_balance_stats
-- House analytics view — call via service role only.
-- ──────────────────────────────────────────────────────────────
create or replace function get_balance_stats()
returns table (
  total_players        bigint,
  total_balances       numeric,
  total_in_play        numeric,   -- sum of stakes on PENDING bets
  total_rake_collected numeric,   -- all-time rake from admin_rake_ledger
  total_paid_out       numeric,   -- total actual_winnings paid on WON bets
  avg_balance          numeric,
  min_balance          numeric,
  max_balance          numeric
)
language sql security definer
set search_path = public
as $$
  select
    count(*)                                     as total_players,
    sum(pb.current_balance)                      as total_balances,
    coalesce(
      (select sum(b.bet_amount)
       from bets b where b.status = 'PENDING'), 0) as total_in_play,
    coalesce((select sum(rake_amount) from admin_rake_ledger), 0) as total_rake_collected,
    coalesce(
      (select sum(b.actual_winnings)
       from bets b where b.status = 'WON'), 0) as total_paid_out,
    round(avg(pb.current_balance), 2)            as avg_balance,
    min(pb.current_balance)                      as min_balance,
    max(pb.current_balance)                      as max_balance
  from player_balances pb
  join users u on u.id = pb.player_id
  where u.is_active = true;
$$;
