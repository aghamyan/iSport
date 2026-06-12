-- ============================================================
-- iSport — Bet Settlement Enhancement Patch
-- Apply AFTER: schema_betting_balance_patch.sql
--
-- Adds:
--   • bet_notifications table         — in-app result alerts
--   • bet_override_audit table        — admin change log
--   • fn_resolve_parlay()             — shared parlay helper (partial WON+RETURNED fix)
--   • settle_bet()        REPLACED    — adds notifications; keeps session_replication_role
--   • settle_market()     REPLACED    — delegates to fn_resolve_parlay
--   • cancel_market()     NEW         — cancels market, bulk-RETURNED all bets
--   • admin_override_bet() NEW        — reverse-settle + audit log, 24h window
--   • get_settlement_report()         — jsonb summary for admin dashboard
--   • get_settlement_report_by_player() — per-player breakdown
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. BET NOTIFICATIONS
-- ──────────────────────────────────────────────────────────────
create table if not exists bet_notifications (
  notif_id   uuid        primary key default gen_random_uuid(),
  player_id  uuid        not null references users(id) on delete cascade,
  bet_id     uuid        not null references bets(bet_id) on delete cascade,
  bet_status bet_status  not null,
  message    text        not null,
  amount     numeric(12,2) not null default 0,  -- positive = credit, negative = loss
  is_read    boolean     not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notif_player_unread
  on bet_notifications (player_id, created_at desc)
  where is_read = false;

alter table bet_notifications enable row level security;

drop policy if exists "player reads own notifications"   on bet_notifications;
drop policy if exists "player marks notification read"   on bet_notifications;
drop policy if exists "no direct insert notifications"   on bet_notifications;

create policy "player reads own notifications"
  on bet_notifications for select
  using (player_id = auth.uid());

create policy "player marks notification read"
  on bet_notifications for update
  using (player_id = auth.uid())
  with check (is_read = true);

-- Inserts only allowed via security-definer functions (settle_bet, admin_override_bet)
create policy "no direct insert notifications"
  on bet_notifications for insert
  with check (false);

-- ──────────────────────────────────────────────────────────────
-- 2. BET OVERRIDE AUDIT
-- ──────────────────────────────────────────────────────────────
create table if not exists bet_override_audit (
  audit_id      uuid        primary key default gen_random_uuid(),
  bet_id        uuid        not null references bets(bet_id) on delete restrict,
  player_id     uuid        not null references users(id)    on delete restrict,
  admin_id      uuid        not null references users(id)    on delete restrict,
  old_status    bet_status  not null,
  new_status    bet_status  not null,
  reason        text        not null,
  balance_delta numeric(12,2) not null default 0,
  overridden_at timestamptz not null default now()
);

create index if not exists idx_override_audit_bet    on bet_override_audit (bet_id);
create index if not exists idx_override_audit_admin  on bet_override_audit (admin_id,   overridden_at desc);
create index if not exists idx_override_audit_player on bet_override_audit (player_id,  overridden_at desc);

alter table bet_override_audit enable row level security;

drop policy if exists "no direct read override audit" on bet_override_audit;
create policy "no direct read override audit"
  on bet_override_audit for select using (false);

-- ──────────────────────────────────────────────────────────────
-- 3. HELPER: fn_resolve_parlay
--
-- Inspects parlay leg results for p_bet_id and settles the
-- parlay if every leg now has a final result.
--
-- Partial WON + RETURNED logic (spec requirement):
--   • ALL RETURNED  → full stake refund
--   • ANY LOST      → LOST (no payout)
--   • ALL WON       → WON at pre-stored actual_winnings
--   • Mixed WON+RET → WON with recalculated odds (product of
--                     WON legs only; exact numeric multiply,
--                     no exp/ln drift)
--
-- Returns TRUE when the parlay was settled this call.
-- Returns FALSE when at least one leg is still PENDING.
-- ──────────────────────────────────────────────────────────────
create or replace function fn_resolve_parlay(
  p_bet_id   uuid,
  p_admin_id uuid,
  p_note     text default null
)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_won_legs   int;
  v_total_legs int;
  v_new_odds   numeric := 1.0;
  v_potential  numeric;
  v_rake       numeric;
  v_actual     numeric;
  v_bet        bets%rowtype;
  v_leg        record;
  v_notes      text;
begin
  -- Any leg still PENDING → parlay not yet resolvable
  if exists (
    select 1 from parlay_legs where bet_id = p_bet_id and result = 'PENDING'
  ) then
    return false;
  end if;

  -- Any LOST leg → whole parlay LOST
  if exists (
    select 1 from parlay_legs where bet_id = p_bet_id and result = 'LOST'
  ) then
    perform settle_bet(p_bet_id, 'LOST', p_admin_id,
      coalesce(p_note, 'Auto-settled: a leg lost'));
    return true;
  end if;

  select
    count(*) filter (where result = 'WON'),
    count(*)
  into v_won_legs, v_total_legs
  from parlay_legs where bet_id = p_bet_id;

  -- All RETURNED → full stake refund
  if v_won_legs = 0 then
    perform settle_bet(p_bet_id, 'RETURNED', p_admin_id,
      coalesce(p_note, 'Auto-settled: all legs returned'));
    return true;
  end if;

  -- All WON → use pre-stored actual_winnings (no recalculation)
  if v_won_legs = v_total_legs then
    perform settle_bet(p_bet_id, 'WON', p_admin_id,
      coalesce(p_note, 'Auto-settled: all legs won'));
    return true;
  end if;

  -- ── Mixed WON + RETURNED: recalculate as reduced parlay ──────
  -- Multiply WON leg odds with exact numeric arithmetic
  -- (avoids the exp(sum(ln(x))) double-precision drift)
  for v_leg in
    select odds_at_placement
    from parlay_legs
    where bet_id = p_bet_id and result = 'WON'
  loop
    v_new_odds := v_new_odds * v_leg.odds_at_placement;
  end loop;

  v_new_odds := round(v_new_odds, 4);

  select * into v_bet from bets where bet_id = p_bet_id;

  v_potential := round(v_bet.bet_amount * v_new_odds, 2);
  v_rake      := round((v_potential - v_bet.bet_amount) * 0.10, 2);
  v_actual    := v_potential - v_rake;

  -- Overwrite bet financials before settling.
  -- Bet is still PENDING so old.is_settled = FALSE — the immutability
  -- trigger (fn_prevent_bet_mutation) permits this update.
  update bets
  set combined_odds      = v_new_odds,
      potential_winnings = v_potential,
      rake_amount        = v_rake,
      actual_winnings    = v_actual
  where bet_id = p_bet_id;

  v_notes := format(
    'Partial parlay: %s/%s legs WON — recalculated odds %s× (rake %s AMD) | %s',
    v_won_legs, v_total_legs, round(v_new_odds, 2), v_rake,
    coalesce(p_note, 'auto-settled')
  );

  perform settle_bet(p_bet_id, 'WON', p_admin_id, v_notes);
  return true;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- 4. REPLACE: settle_bet
--    • Adds in-app bet_notifications insert
--    • Keeps session_replication_role = replica for trigger bypass
--    • Keeps all existing balance + ledger + archive logic
-- ──────────────────────────────────────────────────────────────
create or replace function settle_bet(
  p_bet_id   uuid,
  p_outcome  text,   -- 'WON' | 'LOST' | 'RETURNED' | 'CANCELLED'
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
  v_tx_desc        text;
  v_notif_msg      text;
  v_notif_amount   numeric;
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

  set local session_replication_role = replica;

  -- Transition bet status
  update bets
  set status      = p_outcome::bet_status,
      settled_at  = now(),
      settled_by  = p_admin_id,
      admin_notes = p_notes
  where bet_id = p_bet_id;

  -- Credit balance on WON / RETURNED / CANCELLED
  if p_outcome in ('WON', 'RETURNED', 'CANCELLED') then
    v_credit := case p_outcome
      when 'WON' then v_bet.actual_winnings
      else            v_bet.bet_amount
    end;

    v_tx_type := case p_outcome
      when 'WON'       then 'BET_WON'
      when 'RETURNED'  then 'BET_RETURNED'
      else                  'BET_CANCELLED'
    end::tx_type;

    v_tx_desc := case p_outcome
      when 'WON'      then 'Bet won — ' || v_bet.actual_winnings || ' AMD credited (rake: ' || v_bet.rake_amount || ' AMD)'
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
      p_bet_id, v_tx_desc, p_admin_id
    );

    if p_outcome = 'WON' then
      insert into admin_rake_ledger (bet_id, player_id, rake_amount)
      values (p_bet_id, v_bet.player_id, v_bet.rake_amount);
    end if;
  end if;

  -- JSONB archive snapshot
  insert into bet_history_archive (bet_id, player_id, reason, snapshot)
  values (
    v_bet.bet_id,
    v_bet.player_id,
    lower(p_outcome),
    jsonb_build_object(
      'bet',  row_to_json(v_bet),
      'legs', coalesce(
        (select jsonb_agg(row_to_json(pl)) from parlay_legs pl where pl.bet_id = p_bet_id),
        '[]'::jsonb
      )
    )
  );

  -- In-app notification (DML works fine inside session_replication_role = replica)
  v_notif_msg := case
    when v_bet.bet_type = 'PARLAY' then
      case p_outcome
        when 'WON'      then 'Parlay Won! You earned ' || v_bet.actual_winnings || ' AMD'
        when 'LOST'     then 'Parlay Lost — Better luck next time'
        when 'RETURNED' then 'Parlay Returned — Money refunded'
        else                 'Parlay Cancelled — Money refunded'
      end
    else
      case p_outcome
        when 'WON'      then 'Bet Won! You earned ' || v_bet.actual_winnings || ' AMD'
        when 'LOST'     then 'Bet Lost — Better luck next time'
        when 'RETURNED' then 'Bet Returned — Money refunded'
        else                 'Bet Cancelled — Money refunded'
      end
  end;

  v_notif_amount := case p_outcome
    when 'WON'  then  v_bet.actual_winnings
    when 'LOST' then -v_bet.bet_amount       -- negative signals loss magnitude
    else              v_bet.bet_amount        -- refunded amount
  end;

  insert into bet_notifications (player_id, bet_id, bet_status, message, amount)
  values (v_bet.player_id, p_bet_id, p_outcome::bet_status, v_notif_msg, v_notif_amount);

  set local session_replication_role = default;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- 5. REPLACE: settle_market
--    • Same signature as before
--    • Delegates parlay resolution to fn_resolve_parlay so that
--      the partial WON+RETURNED logic is handled correctly
-- ──────────────────────────────────────────────────────────────
create or replace function settle_market(
  p_market_id      uuid,
  p_winning_option text,   -- option1, option2, option3...
  p_admin_id       uuid
)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_bet_id  uuid;
  v_outcome text;
  v_count   int := 0;
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

  -- Mark market settled and record the winning option
  update bet_markets
  set status     = 'SETTLED',
      result     = p_winning_option,
      settled_at = now(),
      settled_by = p_admin_id
  where market_id = p_market_id;

  -- Write final leg results for every parlay that touches this market
  update parlay_legs
  set result     = case
                     when selected_option = p_winning_option then 'WON'::leg_result
                     else                                         'LOST'::leg_result
                   end,
      settled_at = now()
  where market_id = p_market_id;

  -- ── Settle SINGLE bets ────────────────────────────────────────
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

  -- ── Resolve PARLAY bets whose last pending leg was in this market ──
  for v_bet_id in
    select distinct pl.bet_id
    from parlay_legs pl
    join bets b on b.bet_id = pl.bet_id
    where pl.market_id = p_market_id
      and b.status     = 'PENDING'
      and b.bet_type   = 'PARLAY'
  loop
    if fn_resolve_parlay(v_bet_id, p_admin_id, 'Auto-settled via settle_market') then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- 6. NEW: cancel_market
--
-- Marks a market CANCELLED and refunds all PENDING single bets
-- on it as RETURNED.  Parlay legs on this market are set to
-- RETURNED; fn_resolve_parlay is then called to settle any
-- parlay that now has all legs resolved.
--
-- Returns: number of bets fully settled by this call.
--
-- Draw handling note: a draw result is not a cancellation —
-- use settle_market with 'option2' (the draw option) instead.
-- This function is for mid-stream market voids only.
-- ──────────────────────────────────────────────────────────────
create or replace function cancel_market(
  p_market_id uuid,
  p_admin_id  uuid,
  p_reason    text default null
)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  v_bet_id uuid;
  v_count  int  := 0;
  v_note   text;
begin
  v_note := coalesce('Market cancelled — ' || p_reason, 'Market cancelled');

  -- Mark market cancelled
  update bet_markets
  set status     = 'CANCELLED',
      settled_at = now(),
      settled_by = p_admin_id
  where market_id = p_market_id;

  -- Void only legs that are still PENDING (already-settled legs stay intact)
  update parlay_legs
  set result     = 'RETURNED'::leg_result,
      settled_at = now()
  where market_id = p_market_id
    and result    = 'PENDING';

  -- Refund SINGLE bets
  for v_bet_id in
    select bet_id from bets
    where market_id = p_market_id
      and bet_type  = 'SINGLE'
      and status    = 'PENDING'
  loop
    perform settle_bet(v_bet_id, 'RETURNED', p_admin_id, v_note);
    v_count := v_count + 1;
  end loop;

  -- Resolve PARLAY bets whose last-pending leg was on this market
  for v_bet_id in
    select distinct pl.bet_id
    from parlay_legs pl
    join bets b on b.bet_id = pl.bet_id
    where pl.market_id = p_market_id
      and b.status     = 'PENDING'
      and b.bet_type   = 'PARLAY'
  loop
    if fn_resolve_parlay(v_bet_id, p_admin_id, v_note) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- 7. NEW: admin_override_bet
--
-- Reverse-settles a bet and applies a different outcome.
-- Restricted to bets settled within p_override_hours (default 24).
--
-- Balance is adjusted atomically: old payout reversed, new payout
-- applied.  If the reversal would push the player's balance
-- below zero the function raises an error — the admin must first
-- use admin_adjust_balance to top up, then retry.
--
-- Every override is logged in bet_override_audit and archived.
-- ──────────────────────────────────────────────────────────────
create or replace function admin_override_bet(
  p_bet_id         uuid,
  p_new_status     text,      -- 'WON' | 'LOST' | 'RETURNED'
  p_admin_id       uuid,
  p_reason         text,
  p_override_hours int  default 24
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_bet            bets%rowtype;
  v_old_status     bet_status;
  v_new_status_e   bet_status;
  v_balance_before numeric;
  v_balance_after  numeric;
  v_balance_delta  numeric := 0;
  v_rake_delta     numeric := 0;
begin
  -- Input validation
  if p_new_status not in ('WON','LOST','RETURNED') then
    raise exception 'New status must be WON, LOST, or RETURNED.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Override reason is required.';
  end if;

  -- Fetch and lock the bet
  select * into v_bet from bets where bet_id = p_bet_id for update;
  if not found then
    raise exception 'Bet % not found.', p_bet_id;
  end if;
  if not v_bet.is_settled then
    raise exception 'Bet % is not yet settled. Use settle_market instead.', p_bet_id;
  end if;

  v_old_status   := v_bet.status;
  v_new_status_e := p_new_status::bet_status;

  if v_old_status = v_new_status_e then
    raise exception 'Bet % already has status %. No change needed.', p_bet_id, v_old_status;
  end if;

  -- Enforce override window
  if v_bet.settled_at < now() - (p_override_hours || ' hours')::interval then
    raise exception
      'Cannot override bet % — it was settled more than % hour(s) ago (settled at: %). '
      'Increase the override window or adjust balance manually via admin_adjust_balance.',
      p_bet_id, p_override_hours, v_bet.settled_at;
  end if;

  -- ── Compute net balance and rake delta ──────────────────────
  -- Reverse old settlement effect:
  if v_old_status = 'WON' then
    v_balance_delta := v_balance_delta - v_bet.actual_winnings;
    v_rake_delta    := v_rake_delta    - v_bet.rake_amount;
  elsif v_old_status in ('RETURNED', 'CANCELLED') then
    v_balance_delta := v_balance_delta - v_bet.bet_amount;
  end if;
  -- LOST had no credit, nothing to reverse

  -- Apply new settlement effect:
  if v_new_status_e = 'WON' then
    v_balance_delta := v_balance_delta + v_bet.actual_winnings;
    v_rake_delta    := v_rake_delta    + v_bet.rake_amount;
  elsif v_new_status_e = 'RETURNED' then
    v_balance_delta := v_balance_delta + v_bet.bet_amount;
  end if;

  -- ── Lock player balance and validate ───────────────────────
  select current_balance into v_balance_before
  from player_balances where player_id = v_bet.player_id for update;

  v_balance_after := v_balance_before + v_balance_delta;

  if v_balance_after < 0 then
    raise exception
      'Override of bet % (% → %) would push player''s balance below zero '
      '(current: % AMD, net change: % AMD). '
      'Use admin_adjust_balance to top up first, then retry the override.',
      p_bet_id, v_old_status, p_new_status, v_balance_before, v_balance_delta;
  end if;

  -- ── Apply balance and rake changes (single UPDATE) ─────────
  if v_balance_delta != 0 or v_rake_delta != 0 then
    update player_balances
    set current_balance = v_balance_after,
        total_rake_paid = total_rake_paid + v_rake_delta,
        last_updated    = now()
    where player_id = v_bet.player_id;
  end if;

  -- Balance transaction log
  if v_balance_delta != 0 then
    insert into balance_transactions (
      player_id, tx_type, amount, balance_before, balance_after,
      reference_id, description, created_by
    ) values (
      v_bet.player_id,
      case when v_balance_delta > 0 then 'ADMIN_CREDIT' else 'ADMIN_DEBIT' end::tx_type,
      v_balance_delta,
      v_balance_before, v_balance_after,
      p_bet_id,
      format('Admin override: bet %s changed %s → %s (%s)', p_bet_id, v_old_status, p_new_status, p_reason),
      p_admin_id
    );
  end if;

  -- Rake ledger adjustment (reversal or addition)
  if v_rake_delta != 0 then
    insert into admin_rake_ledger (bet_id, player_id, rake_amount)
    values (p_bet_id, v_bet.player_id, v_rake_delta);
  end if;

  -- ── Update bet row (bypass immutability trigger) ────────────
  -- old.is_settled = TRUE here — we deliberately override a settled bet.
  set local session_replication_role = replica;
  update bets
  set status      = v_new_status_e,
      settled_at  = now(),
      settled_by  = p_admin_id,
      admin_notes = coalesce(v_bet.admin_notes || ' | ', '') ||
                    format('Override by %s at %s: %s', p_admin_id, now(), p_reason)
  where bet_id = p_bet_id;
  set local session_replication_role = default;

  -- ── Audit log ────────────────────────────────────────────────
  insert into bet_override_audit (
    bet_id, player_id, admin_id, old_status, new_status, reason, balance_delta
  ) values (
    p_bet_id, v_bet.player_id, p_admin_id,
    v_old_status, v_new_status_e, p_reason, v_balance_delta
  );

  -- ── Archive new state snapshot ───────────────────────────────
  select * into v_bet from bets where bet_id = p_bet_id;

  insert into bet_history_archive (bet_id, player_id, reason, snapshot)
  values (
    v_bet.bet_id,
    v_bet.player_id,
    'admin_override',
    jsonb_build_object(
      'bet',      row_to_json(v_bet),
      'override', jsonb_build_object(
        'old_status',    v_old_status,
        'new_status',    p_new_status,
        'balance_delta', v_balance_delta,
        'reason',        p_reason,
        'admin_id',      p_admin_id,
        'overridden_at', now()
      ),
      'legs', coalesce(
        (select jsonb_agg(row_to_json(pl)) from parlay_legs pl where pl.bet_id = p_bet_id),
        '[]'::jsonb
      )
    )
  );
end;
$$;

-- ──────────────────────────────────────────────────────────────
-- 8. NEW: get_settlement_report
--
-- Aggregate summary of bets settled within [p_from, p_to].
-- Returns a single jsonb row suitable for the admin dashboard.
--
-- House perspective:
--   total_rake        = profit from winning bets (10% of net)
--   total_stakes_lost = stakes kept on losing bets
--   total_payout      = actual_winnings paid out on WON bets
--   total_refunded    = stakes returned on RETURNED / CANCELLED
-- ──────────────────────────────────────────────────────────────
create or replace function get_settlement_report(
  p_from timestamptz default now() - interval '30 days',
  p_to   timestamptz default now()
)
returns jsonb
language sql security definer
set search_path = public
as $$
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'summary', jsonb_build_object(
      'total_bets',        count(*),
      'total_won',         count(*) filter (where status = 'WON'),
      'total_lost',        count(*) filter (where status = 'LOST'),
      'total_returned',    count(*) filter (where status = 'RETURNED'),
      'total_cancelled',   count(*) filter (where status = 'CANCELLED'),
      'total_payout',      coalesce(sum(actual_winnings) filter (where status = 'WON'),            0),
      'total_rake',        coalesce(sum(rake_amount)     filter (where status = 'WON'),            0),
      'total_refunded',    coalesce(sum(bet_amount) filter (where status in ('RETURNED','CANCELLED')), 0),
      'total_stakes_lost', coalesce(sum(bet_amount) filter (where status = 'LOST'),                0),
      'biggest_win',       max(actual_winnings) filter (where status = 'WON'),
      'biggest_bet',       max(bet_amount)
    ),
    'by_type', jsonb_build_object(
      'single', jsonb_build_object(
        'count', count(*) filter (where bet_type = 'SINGLE'),
        'won',   count(*) filter (where bet_type = 'SINGLE' and status = 'WON'),
        'lost',  count(*) filter (where bet_type = 'SINGLE' and status = 'LOST')
      ),
      'parlay', jsonb_build_object(
        'count', count(*) filter (where bet_type = 'PARLAY'),
        'won',   count(*) filter (where bet_type = 'PARLAY' and status = 'WON'),
        'lost',  count(*) filter (where bet_type = 'PARLAY' and status = 'LOST')
      )
    )
  )
  from bets
  where settled_at between p_from and p_to;
$$;

-- ──────────────────────────────────────────────────────────────
-- 9. NEW: get_settlement_report_by_player
--
-- Per-player breakdown for the admin settlement report.
-- net_result = actual winnings received - stakes lost (refunds neutral).
-- ──────────────────────────────────────────────────────────────
create or replace function get_settlement_report_by_player(
  p_from timestamptz default now() - interval '30 days',
  p_to   timestamptz default now()
)
returns table (
  player_id     uuid,
  player_name   text,
  bets_placed   bigint,
  bets_won      bigint,
  bets_lost     bigint,
  bets_returned bigint,
  total_staked  numeric,
  total_won     numeric,
  total_rake    numeric,
  net_result    numeric
)
language sql security definer
set search_path = public
as $$
  select
    b.player_id,
    u.name                                                                        as player_name,
    count(*)                                                                      as bets_placed,
    count(*) filter (where b.status = 'WON')                                    as bets_won,
    count(*) filter (where b.status = 'LOST')                                   as bets_lost,
    count(*) filter (where b.status in ('RETURNED','CANCELLED'))                as bets_returned,
    coalesce(sum(b.bet_amount),                                               0) as total_staked,
    coalesce(sum(b.actual_winnings) filter (where b.status = 'WON'),          0) as total_won,
    coalesce(sum(b.rake_amount)     filter (where b.status = 'WON'),          0) as total_rake,
    -- net from player's perspective: winnings received minus stakes lost
    coalesce(sum(b.actual_winnings) filter (where b.status = 'WON'),          0)
    - coalesce(sum(b.bet_amount)    filter (where b.status = 'LOST'),         0) as net_result
  from bets b
  join users u on u.id = b.player_id
  where b.settled_at between p_from and p_to
  group by b.player_id, u.name
  order by total_staked desc;
$$;
