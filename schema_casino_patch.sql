-- ============================================================
-- iSport — Casino System Patch  (idempotent)
-- Apply AFTER: schema_betting_balance_patch.sql
--
-- Adds:
--   • CASINO_BET, CASINO_WIN values to tx_type enum
--   • casino_config table
--   • casino_sessions table
--   • casino_play()  — atomic debit + credit in one TX
--   • casino_leaderboard view
--   • casino_player_stats() — per-player aggregate
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. Extend tx_type enum
--    These two ALTER statements cannot be rolled back.
--    If you wrap this script in a BEGIN/COMMIT block, the new
--    enum values will only be visible AFTER the block commits —
--    run them separately first if that applies.
-- ──────────────────────────────────────────────────────────────
alter type tx_type add value if not exists 'CASINO_BET';
alter type tx_type add value if not exists 'CASINO_WIN';

-- ──────────────────────────────────────────────────────────────
-- 2. Casino config (one row per game slug)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.casino_config (
  game_slug      text          primary key,
  game_name      text          not null,
  game_type      text          not null check (game_type in ('slot','roulette','dice','blackjack')),
  is_active      boolean       not null default true,
  rtp            numeric(5,2)  not null default 96.00 check (rtp between 0 and 100),
  min_bet        numeric(12,2) not null default 10,
  max_bet        numeric(12,2) not null default 10000,
  jackpot_amount numeric(14,2) not null default 100000,
  extra          jsonb         not null default '{}'::jsonb,
  updated_at     timestamptz   not null default now()
);

-- Seed default games
insert into public.casino_config
  (game_slug, game_name, game_type, rtp, min_bet, max_bet, jackpot_amount)
values
  ('champions-crown',   'Champions Crown',   'slot',     96.5, 10, 5000,  500000),
  ('golden-goal',       'Golden Goal',       'slot',     95.0, 10, 10000, 1000000),
  ('stadium-fortune',   'Stadium Fortune',   'slot',     97.0, 10, 5000,  250000),
  ('ultimate-xi',       'Ultimate XI',       'slot',     94.5, 10, 10000, 750000),
  ('trophy-rush',       'Trophy Rush',       'slot',     96.0, 10, 5000,  500000),
  ('european-roulette', 'European Roulette', 'roulette', 97.3, 10, 50000, 0)
on conflict (game_slug) do nothing;

-- RLS: anyone can read; only admins can write
alter table public.casino_config enable row level security;

drop policy if exists "casino_config_read"        on public.casino_config;
drop policy if exists "casino_config_admin_write" on public.casino_config;

create policy "casino_config_read"
  on public.casino_config for select
  using (true);

create policy "casino_config_admin_write"
  on public.casino_config for all
  using      (exists (select 1 from public.users where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

-- ──────────────────────────────────────────────────────────────
-- 3. Casino sessions (one row per play / roulette round)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.casino_sessions (
  id                uuid          primary key default gen_random_uuid(),
  player_id         uuid          not null references public.users(id)         on delete restrict,
  game_slug         text          not null references public.casino_config(game_slug),
  bet_amount        numeric(12,2) not null,
  payout_multiplier numeric(8,4)  not null default 0,
  winnings          numeric(14,2) not null,  -- bet_amount * payout_multiplier
  net_change        numeric(14,2) not null,  -- winnings - bet_amount
  game_data         jsonb         not null default '{}'::jsonb,
  created_at        timestamptz   not null default now()
);

create index if not exists idx_casino_player_time on public.casino_sessions (player_id, created_at desc);
create index if not exists idx_casino_game_time   on public.casino_sessions (game_slug,  created_at desc);
create index if not exists idx_casino_winnings    on public.casino_sessions (winnings desc);

-- RLS: players see their own; admins see all; inserts only via casino_play() security definer
alter table public.casino_sessions enable row level security;

drop policy if exists "casino_sessions_own"   on public.casino_sessions;
drop policy if exists "casino_sessions_admin" on public.casino_sessions;

create policy "casino_sessions_own"
  on public.casino_sessions for select
  using (player_id = auth.uid());

create policy "casino_sessions_admin"
  on public.casino_sessions for select
  using (exists (select 1 from public.users where id = auth.uid() and is_admin = true));

-- ──────────────────────────────────────────────────────────────
-- 4. casino_play() — atomic debit + credit
--    security definer → runs as function owner, bypasses RLS
--    set search_path = '' → prevents schema-injection attacks
-- ──────────────────────────────────────────────────────────────
create or replace function public.casino_play(
  p_player_id         uuid,
  p_game_slug         text,
  p_bet_amount        numeric,
  p_payout_multiplier numeric,
  p_game_data         jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance       numeric;
  v_winnings      numeric;
  v_net_change    numeric;
  v_session_id    uuid;
  v_balance_after numeric;
  v_config        record;
begin
  -- Validate game exists and is active
  select min_bet, max_bet, is_active
  into   v_config
  from   public.casino_config
  where  game_slug = p_game_slug;

  if not found then
    raise exception 'Unknown casino game: %', p_game_slug;
  end if;

  if not v_config.is_active then
    raise exception 'This game is currently unavailable.';
  end if;

  if p_bet_amount < v_config.min_bet then
    raise exception 'Bet is below the minimum of %.', v_config.min_bet;
  end if;

  if p_bet_amount > v_config.max_bet then
    raise exception 'Bet exceeds the maximum of %.', v_config.max_bet;
  end if;

  -- Lock the player balance row to prevent concurrent bets
  select current_balance
  into   v_balance
  from   public.player_balances
  where  player_id = p_player_id
  for update;

  if not found then
    raise exception 'Player balance not found.';
  end if;

  if v_balance < p_bet_amount then
    raise exception 'Insufficient balance.';
  end if;

  -- Compute outcome
  v_winnings   := round(p_bet_amount * p_payout_multiplier, 2);
  v_net_change := v_winnings - p_bet_amount;

  -- Record session
  insert into public.casino_sessions
    (player_id, game_slug, bet_amount, payout_multiplier, winnings, net_change, game_data)
  values
    (p_player_id, p_game_slug, p_bet_amount, p_payout_multiplier, v_winnings, v_net_change, p_game_data)
  returning id into v_session_id;

  -- Update balance (single statement for atomicity)
  v_balance_after := v_balance + v_net_change;

  update public.player_balances
  set    current_balance = v_balance_after
  where  player_id = p_player_id;

  -- Debit transaction record
  insert into public.balance_transactions
    (player_id, tx_type, amount, balance_before, balance_after, reference_id, description)
  values
    (p_player_id, 'CASINO_BET', -p_bet_amount,
     v_balance, v_balance - p_bet_amount,
     v_session_id, p_game_slug || ' — Bet');

  -- Credit transaction record (only when the player wins something)
  if v_winnings > 0 then
    insert into public.balance_transactions
      (player_id, tx_type, amount, balance_before, balance_after, reference_id, description)
    values
      (p_player_id, 'CASINO_WIN', v_winnings,
       v_balance - p_bet_amount, v_balance_after,
       v_session_id, p_game_slug || ' — Win ×' || round(p_payout_multiplier, 2));
  end if;

  return jsonb_build_object(
    'session_id',  v_session_id,
    'new_balance', v_balance_after,
    'winnings',    v_winnings,
    'net_change',  v_net_change
  );
end;
$$;

grant execute on function public.casino_play(uuid, text, numeric, numeric, jsonb)
  to authenticated, service_role;

-- ──────────────────────────────────────────────────────────────
-- 5. Casino leaderboard view (top wins all-time)
--    Queried via service-role server actions — bypasses RLS
-- ──────────────────────────────────────────────────────────────
create or replace view public.casino_leaderboard as
select
  cs.id,
  cs.player_id,
  u.name              as player_name,
  u.avatar_url,
  cs.game_slug,
  cc.game_name,
  cs.bet_amount,
  cs.winnings,
  cs.payout_multiplier,
  cs.net_change,
  cs.created_at
from   public.casino_sessions cs
join   public.users            u  on u.id         = cs.player_id
join   public.casino_config    cc on cc.game_slug = cs.game_slug
where  cs.winnings > 0
order  by cs.winnings desc;

grant select on public.casino_leaderboard to authenticated, service_role;

-- ──────────────────────────────────────────────────────────────
-- 6. casino_player_stats() — per-player aggregate
-- ──────────────────────────────────────────────────────────────
create or replace function public.casino_player_stats(p_player_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'games_played',  count(*),
    'total_wagered', coalesce(sum(bet_amount), 0),
    'total_won',     coalesce(sum(winnings), 0),
    'total_lost',    coalesce(sum(bet_amount) - sum(winnings), 0),
    'net_change',    coalesce(sum(net_change), 0),
    'biggest_win',   coalesce(max(winnings), 0),
    'biggest_multi', coalesce(max(payout_multiplier), 0),
    'win_count',     count(*) filter (where payout_multiplier > 1),
    'loss_count',    count(*) filter (where payout_multiplier < 1),
    'jackpots_won',  count(*) filter (where payout_multiplier >= 100),
    'favorite_game', (
      select game_slug
      from   public.casino_sessions
      where  player_id = p_player_id
      group  by game_slug
      order  by count(*) desc
      limit  1
    )
  )
  from public.casino_sessions
  where player_id = p_player_id;
$$;

grant execute on function public.casino_player_stats(uuid)
  to authenticated, service_role;
