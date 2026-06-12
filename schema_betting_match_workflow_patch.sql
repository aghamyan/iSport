-- ============================================================
-- iSport - Betting settlement workflow for final match results
-- Apply AFTER: schema_betting_settlement_patch.sql
--
-- Adds:
--   - Match-level settlement audit + error tables
--   - Score-derived standard-market resolution
--   - Match FINAL triggers for friendly/championship matches
--   - Due-finalization and cancellation RPCs
--   - Retry/error report RPCs
--   - Friendlier bet settlement notifications with match titles
-- ============================================================

-- --------------------------------------------------------------
-- 1. MATCH SETTLEMENT AUDIT + ERROR LOGS
-- --------------------------------------------------------------
create table if not exists bet_settlement_audit (
  audit_id               uuid primary key default gen_random_uuid(),
  match_id               uuid not null,
  match_type             match_ref_type not null,
  result                 jsonb not null,
  markets_settled        int not null default 0,
  markets_skipped        int not null default 0,
  failed_count           int not null default 0,
  bets_affected          int not null default 0,
  total_staked           numeric(12,2) not null default 0,
  total_winnings_paid    numeric(12,2) not null default 0,
  total_rake_collected   numeric(12,2) not null default 0,
  settlement_status      text not null default 'SUCCESS'
                            check (settlement_status in ('SUCCESS','PARTIAL','FAILED','CANCELLED')),
  triggered_by           uuid references users(id) on delete set null,
  notes                  text,
  created_at             timestamptz not null default now()
);

create index if not exists idx_settlement_audit_match
  on bet_settlement_audit (match_id, match_type, created_at desc);

create index if not exists idx_settlement_audit_created
  on bet_settlement_audit (created_at desc);

create table if not exists bet_settlement_errors (
  error_id       uuid primary key default gen_random_uuid(),
  audit_id       uuid references bet_settlement_audit(audit_id) on delete set null,
  match_id       uuid not null,
  match_type     match_ref_type not null,
  market_id      uuid references bet_markets(market_id) on delete set null,
  bet_id         uuid references bets(bet_id) on delete set null,
  error_message  text not null,
  retry_count    int not null default 0,
  last_retry_at  timestamptz,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_settlement_errors_open
  on bet_settlement_errors (created_at desc)
  where resolved_at is null;

create index if not exists idx_settlement_errors_match
  on bet_settlement_errors (match_id, match_type, created_at desc);

alter table bet_settlement_audit  enable row level security;
alter table bet_settlement_errors enable row level security;

drop policy if exists "no direct settlement audit read" on bet_settlement_audit;
create policy "no direct settlement audit read"
  on bet_settlement_audit for select using (false);

drop policy if exists "no direct settlement error read" on bet_settlement_errors;
create policy "no direct settlement error read"
  on bet_settlement_errors for select using (false);

-- --------------------------------------------------------------
-- 2. STRICT FINAL-MATCH EDIT GUARD
--
-- The original function blocked edits after the 4-hour confirmed window.
-- This version also blocks player edits once a match is FINAL. Admins still
-- use service-role actions for rare data repair; betting is never resettled
-- by score edits because settlement only runs on the transition into FINAL.
-- --------------------------------------------------------------
create or replace function prevent_late_edit()
returns trigger language plpgsql as $$
declare
  v_uid      uuid := auth.uid();
  v_is_admin boolean := v_uid is null or coalesce((select is_admin from users where id = v_uid), false);
begin
  if old.status = 'final' and not v_is_admin then
    raise exception 'Match is final and cannot be edited';
  end if;

  if old.status = 'confirmed'
     and now() > old.confirmed_at + interval '4 hours'
     and not v_is_admin
  then
    raise exception 'Edit window has expired';
  end if;

  return new;
end;
$$;

-- --------------------------------------------------------------
-- 3. SCORE -> MARKET OPTION HELPERS
-- --------------------------------------------------------------
create or replace function fn_market_option_for_key(
  p_options jsonb,
  p_key     text
)
returns text
language sql immutable
as $$
  select opt.key
  from jsonb_each(p_options) as opt(key, value)
  where opt.value ->> 'key' = p_key
  order by opt.key
  limit 1;
$$;

create or replace function fn_market_option_for_label(
  p_options jsonb,
  p_label   text
)
returns text
language sql immutable
as $$
  select opt.key
  from jsonb_each(p_options) as opt(key, value)
  where lower(opt.value ->> 'label') = lower(p_label)
     or lower(opt.value ->> 'key')   = lower(p_label)
  order by opt.key
  limit 1;
$$;

create or replace function fn_market_option_numeric_line(
  p_options jsonb,
  p_option  text
)
returns numeric
language sql immutable
as $$
  select nullif(substring(coalesce(p_options -> p_option ->> 'label', '') from '([+-][0-9]+(\.[0-9]+)?)'), '')::numeric;
$$;

create or replace function fn_winning_option_for_score(
  p_market_id  uuid,
  p_home_score int,
  p_away_score int
)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_market      bet_markets%rowtype;
  v_total_goals int := p_home_score + p_away_score;
  v_home_line   numeric;
  v_away_line   numeric;
  v_score_label text;
  v_option      text;
begin
  select * into v_market
  from bet_markets
  where market_id = p_market_id;

  if not found then
    raise exception 'Market % not found.', p_market_id;
  end if;

  if p_home_score is null or p_away_score is null then
    raise exception 'Cannot settle market % without final scores.', p_market_id;
  end if;

  case v_market.market_type
    when '1X2' then
      if p_home_score > p_away_score then
        v_option := fn_market_option_for_key(v_market.options, 'home');
      elsif p_home_score < p_away_score then
        v_option := fn_market_option_for_key(v_market.options, 'away');
      else
        v_option := fn_market_option_for_key(v_market.options, 'draw');
      end if;

    when 'OU2_5' then
      v_option := fn_market_option_for_key(
        v_market.options,
        case when v_total_goals > 2.5 then 'over' else 'under' end
      );

    when 'HANDICAP' then
      v_home_line := coalesce(fn_market_option_numeric_line(v_market.options, 'option1'), 0);
      v_away_line := coalesce(fn_market_option_numeric_line(v_market.options, 'option2'), 0);

      if p_home_score + v_home_line > p_away_score then
        v_option := fn_market_option_for_key(v_market.options, 'home_hcap');
      elsif p_away_score + v_away_line > p_home_score then
        v_option := fn_market_option_for_key(v_market.options, 'away_hcap');
      else
        return null; -- push; caller returns the market
      end if;

    when 'BTTS' then
      v_option := fn_market_option_for_key(
        v_market.options,
        case when p_home_score > 0 and p_away_score > 0 then 'yes' else 'no' end
      );

    when 'EXACT_SCORE' then
      v_score_label := p_home_score || '-' || p_away_score;
      v_option := coalesce(
        fn_market_option_for_label(v_market.options, v_score_label),
        fn_market_option_for_key(v_market.options, 'other'),
        fn_market_option_for_label(v_market.options, 'Other')
      );

    else
      return null;
  end case;

  if v_option is null or not (v_market.options ? v_option) then
    raise exception 'Could not derive winning option for market % (%).', p_market_id, v_market.market_type;
  end if;

  return v_option;
end;
$$;

-- --------------------------------------------------------------
-- 4. FRIENDLIER SETTLEMENT NOTIFICATIONS
--    Replaces settle_bet from schema_betting_settlement_patch.sql.
-- --------------------------------------------------------------
create or replace function fn_bet_match_title(p_bet_id uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  v_match_id   uuid;
  v_match_type match_ref_type;
  v_home_name  text;
  v_away_name  text;
begin
  select bm.match_id, bm.match_type
  into v_match_id, v_match_type
  from bets b
  left join bet_markets bm on bm.market_id = b.market_id
  where b.bet_id = p_bet_id
  limit 1;

  if v_match_id is null then
    select bm.match_id, bm.match_type
    into v_match_id, v_match_type
    from parlay_legs pl
    join bet_markets bm on bm.market_id = pl.market_id
    where pl.bet_id = p_bet_id
    order by pl.leg_order
    limit 1;
  end if;

  if v_match_id is null then
    return 'your match';
  end if;

  if v_match_type = 'friendly' then
    select hu.name, au.name
    into v_home_name, v_away_name
    from friendly_matches fm
    join users hu on hu.id = fm.home_player_id
    join users au on au.id = fm.away_player_id
    where fm.id = v_match_id;
  else
    select hu.name, au.name
    into v_home_name, v_away_name
    from championship_matches cm
    join users hu on hu.id = cm.home_player_id
    join users au on au.id = cm.away_player_id
    where cm.id = v_match_id;
  end if;

  return coalesce(v_home_name, 'Home') || ' vs ' || coalesce(v_away_name, 'Away');
end;
$$;

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
  v_match_title    text;
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

  v_match_title := fn_bet_match_title(p_bet_id);

  set local session_replication_role = replica;

  update bets
  set status      = p_outcome::bet_status,
      settled_at  = now(),
      settled_by  = p_admin_id,
      admin_notes = p_notes
  where bet_id = p_bet_id;

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
      when 'WON'      then 'Bet won on ' || v_match_title || ' - ' || v_bet.actual_winnings || ' AMD credited (rake: ' || v_bet.rake_amount || ' AMD)'
      when 'RETURNED' then 'Bet on ' || v_match_title || ' returned - stake refunded'
      else                 'Bet on ' || v_match_title || ' cancelled - stake refunded'
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

  v_notif_msg := case p_outcome
    when 'WON'      then 'Your bet on ' || v_match_title || ' was WON! Earned ' || v_bet.actual_winnings || ' AMD'
    when 'LOST'     then 'Your bet on ' || v_match_title || ' was LOST'
    when 'RETURNED' then 'Your bet on ' || v_match_title || ' was RETURNED. Refunded ' || v_bet.bet_amount || ' AMD'
    else                 'Your bet on ' || v_match_title || ' was CANCELLED. Refunded ' || v_bet.bet_amount || ' AMD'
  end;

  v_notif_amount := case p_outcome
    when 'WON'  then  v_bet.actual_winnings
    when 'LOST' then -v_bet.bet_amount
    else              v_bet.bet_amount
  end;

  insert into bet_notifications (player_id, bet_id, bet_status, message, amount)
  values (v_bet.player_id, p_bet_id, p_outcome::bet_status, v_notif_msg, v_notif_amount);

  set local session_replication_role = default;
end;
$$;

-- --------------------------------------------------------------
-- 5. SETTLEMENT TRIGGER FUNCTION: called when match becomes FINAL
-- --------------------------------------------------------------
create or replace function settle_match_bets(
  p_match_id   uuid,
  p_match_type match_ref_type,
  p_admin_id   uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_home_score     int;
  v_away_score     int;
  v_status         match_status;
  v_started_at     timestamptz := now();
  v_market         record;
  v_winning_option text;
  v_bets_settled   int;
  v_markets_settled int := 0;
  v_markets_skipped int := 0;
  v_failed_count    int := 0;
  v_bets_affected   int := 0;
  v_total_staked    numeric := 0;
  v_total_winnings  numeric := 0;
  v_total_rake      numeric := 0;
  v_audit_id        uuid;
  v_result          jsonb;
begin
  if p_match_type = 'friendly' then
    select status, home_score, away_score
    into v_status, v_home_score, v_away_score
    from friendly_matches
    where id = p_match_id;
  else
    select status, home_score, away_score
    into v_status, v_home_score, v_away_score
    from championship_matches
    where id = p_match_id;
  end if;

  if not found then
    raise exception 'Match % (%) not found.', p_match_id, p_match_type;
  end if;

  if v_status != 'final' then
    raise exception 'Match % is %, not final.', p_match_id, v_status;
  end if;

  if v_home_score is null or v_away_score is null then
    raise exception 'Match % cannot settle without final scores.', p_match_id;
  end if;

  for v_market in
    select market_id, market_type
    from bet_markets
    where match_id = p_match_id
      and match_type = p_match_type
      and status in ('OPEN','LOCKED')
    order by created_at
  loop
    begin
      if v_market.market_type = 'CUSTOM_PROP' then
        v_markets_skipped := v_markets_skipped + 1;
        continue;
      end if;

      v_winning_option := fn_winning_option_for_score(v_market.market_id, v_home_score, v_away_score);

      if v_winning_option is null then
        v_bets_settled := cancel_market(
          v_market.market_id,
          p_admin_id,
          'Market returned by final-score settlement (push/no winner)'
        );
      else
        v_bets_settled := settle_market(v_market.market_id, v_winning_option, p_admin_id);
      end if;

      v_markets_settled := v_markets_settled + 1;
      v_bets_affected   := v_bets_affected + coalesce(v_bets_settled, 0);

    exception when others then
      v_failed_count := v_failed_count + 1;

      insert into bet_settlement_errors (
        match_id, match_type, market_id, error_message
      ) values (
        p_match_id, p_match_type, v_market.market_id, sqlerrm
      );
    end;
  end loop;

  select
    count(*),
    coalesce(sum(bet_amount), 0),
    coalesce(sum(actual_winnings) filter (where status = 'WON'), 0),
    coalesce(sum(rake_amount)     filter (where status = 'WON'), 0)
  into v_bets_affected, v_total_staked, v_total_winnings, v_total_rake
  from bets b
  where b.settled_at >= v_started_at
    and (
      exists (
        select 1
        from bet_markets bm
        where bm.market_id = b.market_id
          and bm.match_id = p_match_id
          and bm.match_type = p_match_type
      )
      or exists (
        select 1
        from parlay_legs pl
        join bet_markets bm on bm.market_id = pl.market_id
        where pl.bet_id = b.bet_id
          and bm.match_id = p_match_id
          and bm.match_type = p_match_type
      )
    );

  v_result := jsonb_build_object(
    'home_score', v_home_score,
    'away_score', v_away_score,
    'score',      v_home_score || '-' || v_away_score
  );

  insert into bet_settlement_audit (
    match_id, match_type, result,
    markets_settled, markets_skipped, failed_count,
    bets_affected, total_staked, total_winnings_paid, total_rake_collected,
    settlement_status, triggered_by
  ) values (
    p_match_id, p_match_type, v_result,
    v_markets_settled, v_markets_skipped, v_failed_count,
    v_bets_affected, v_total_staked, v_total_winnings, v_total_rake,
    case
      when v_failed_count > 0 and v_markets_settled = 0 then 'FAILED'
      when v_failed_count > 0 or v_markets_skipped > 0 then 'PARTIAL'
      else 'SUCCESS'
    end,
    p_admin_id
  )
  returning audit_id into v_audit_id;

  update bet_settlement_errors
  set audit_id = v_audit_id
  where audit_id is null
    and match_id = p_match_id
    and match_type = p_match_type
    and created_at >= v_started_at;

  return jsonb_build_object(
    'audit_id',              v_audit_id,
    'match_id',              p_match_id,
    'match_type',            p_match_type,
    'result',                v_result,
    'markets_settled',       v_markets_settled,
    'markets_skipped',       v_markets_skipped,
    'failed_count',          v_failed_count,
    'bets_affected',         v_bets_affected,
    'total_staked',          v_total_staked,
    'total_winnings_paid',   v_total_winnings,
    'total_rake_collected',  v_total_rake
  );
end;
$$;

create or replace function trg_settle_match_bets_on_final()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_match_type match_ref_type := tg_argv[0]::match_ref_type;
begin
  if tg_op = 'UPDATE'
     and new.status = 'final'
     and old.status is distinct from new.status
  then
    perform settle_match_bets(new.id, v_match_type, auth.uid());
  end if;

  return null;
end;
$$;

drop trigger if exists trg_friendly_betting_on_final on friendly_matches;
create trigger trg_friendly_betting_on_final
  after update on friendly_matches
  for each row execute function trg_settle_match_bets_on_final('friendly');

drop trigger if exists trg_championship_betting_on_final on championship_matches;
create trigger trg_championship_betting_on_final
  after update on championship_matches
  for each row execute function trg_settle_match_bets_on_final('championship');

-- --------------------------------------------------------------
-- 6. FINALIZATION, CANCELLATION, RETRY
-- --------------------------------------------------------------
create or replace function finalize_due_matches(
  p_admin_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_friendly_count int := 0;
  v_champ_count    int := 0;
begin
  if p_admin_id is not null then
    perform set_config('request.jwt.claim.sub', p_admin_id::text, true);
  end if;

  update friendly_matches
  set status = 'final'
  where status = 'confirmed'
    and confirmed_at <= now() - interval '4 hours';
  get diagnostics v_friendly_count = row_count;

  update championship_matches
  set status = 'final'
  where status = 'confirmed'
    and confirmed_at <= now() - interval '4 hours';
  get diagnostics v_champ_count = row_count;

  return jsonb_build_object(
    'friendly_finalized',     v_friendly_count,
    'championship_finalized', v_champ_count,
    'total_finalized',        v_friendly_count + v_champ_count
  );
end;
$$;

create or replace function cancel_match_bets(
  p_match_id   uuid,
  p_match_type match_ref_type,
  p_admin_id   uuid,
  p_reason     text default 'Match cancelled'
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_started_at      timestamptz := now();
  v_market          record;
  v_bets_refunded   int;
  v_markets_settled int := 0;
  v_failed_count    int := 0;
  v_bets_affected   int := 0;
  v_total_refunded  numeric := 0;
  v_audit_id        uuid;
begin
  for v_market in
    select market_id
    from bet_markets
    where match_id = p_match_id
      and match_type = p_match_type
      and status in ('OPEN','LOCKED')
  loop
    begin
      v_bets_refunded := cancel_market(v_market.market_id, p_admin_id, p_reason);
      v_markets_settled := v_markets_settled + 1;
      v_bets_affected   := v_bets_affected + coalesce(v_bets_refunded, 0);
    exception when others then
      v_failed_count := v_failed_count + 1;
      insert into bet_settlement_errors (
        match_id, match_type, market_id, error_message
      ) values (
        p_match_id, p_match_type, v_market.market_id, sqlerrm
      );
    end;
  end loop;

  select
    count(*),
    coalesce(sum(bet_amount), 0)
  into v_bets_affected, v_total_refunded
  from bets b
  where b.settled_at >= v_started_at
    and b.status in ('RETURNED','CANCELLED')
    and (
      exists (
        select 1
        from bet_markets bm
        where bm.market_id = b.market_id
          and bm.match_id = p_match_id
          and bm.match_type = p_match_type
      )
      or exists (
        select 1
        from parlay_legs pl
        join bet_markets bm on bm.market_id = pl.market_id
        where pl.bet_id = b.bet_id
          and bm.match_id = p_match_id
          and bm.match_type = p_match_type
      )
    );

  insert into bet_settlement_audit (
    match_id, match_type, result,
    markets_settled, failed_count, bets_affected,
    total_staked, total_winnings_paid, total_rake_collected,
    settlement_status, triggered_by, notes
  ) values (
    p_match_id, p_match_type,
    jsonb_build_object('cancelled', true, 'reason', coalesce(p_reason, 'Match cancelled')),
    v_markets_settled, v_failed_count, v_bets_affected,
    v_total_refunded, 0, 0,
    case when v_failed_count > 0 then 'PARTIAL' else 'CANCELLED' end,
    p_admin_id, p_reason
  )
  returning audit_id into v_audit_id;

  update bet_settlement_errors
  set audit_id = v_audit_id
  where audit_id is null
    and match_id = p_match_id
    and match_type = p_match_type
    and created_at >= v_started_at;

  return jsonb_build_object(
    'audit_id',       v_audit_id,
    'bets_refunded',  v_bets_affected,
    'total_refunded', v_total_refunded,
    'failed_count',   v_failed_count
  );
end;
$$;

create or replace function retry_failed_settlements(
  p_admin_id uuid default null,
  p_limit    int default 20
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_err        record;
  v_result     jsonb;
  v_retry_failed int;
  v_attempted  int := 0;
  v_resolved   int := 0;
  v_failed     int := 0;
begin
  for v_err in
    select distinct on (match_id, match_type)
      match_id, match_type
    from bet_settlement_errors
    where resolved_at is null
    order by match_id, match_type, created_at
    limit p_limit
  loop
    v_attempted := v_attempted + 1;
    begin
      v_result := settle_match_bets(v_err.match_id, v_err.match_type, p_admin_id);
      v_retry_failed := coalesce((v_result ->> 'failed_count')::int, 0);

      if v_retry_failed = 0 then
        update bet_settlement_errors
        set resolved_at   = now(),
            retry_count   = retry_count + 1,
            last_retry_at = now()
        where match_id = v_err.match_id
          and match_type = v_err.match_type
          and resolved_at is null;

        v_resolved := v_resolved + 1;
      else
        update bet_settlement_errors
        set retry_count   = retry_count + 1,
            last_retry_at = now()
        where match_id = v_err.match_id
          and match_type = v_err.match_type
          and resolved_at is null;

        v_failed := v_failed + 1;
      end if;
    exception when others then
      update bet_settlement_errors
      set retry_count   = retry_count + 1,
          last_retry_at = now(),
          error_message = sqlerrm
      where match_id = v_err.match_id
        and match_type = v_err.match_type
        and resolved_at is null;

      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'attempted', v_attempted,
    'resolved',  v_resolved,
    'failed',    v_failed
  );
end;
$$;

-- --------------------------------------------------------------
-- 7. REPORT RPCS
-- --------------------------------------------------------------
create or replace function get_settlement_audit_report(
  p_from timestamptz default now() - interval '30 days',
  p_to   timestamptz default now()
)
returns table (
  audit_id              uuid,
  match_id              uuid,
  match_type            match_ref_type,
  result                jsonb,
  markets_settled       int,
  markets_skipped       int,
  failed_count          int,
  bets_affected         int,
  total_staked          numeric,
  total_winnings_paid   numeric,
  total_rake_collected  numeric,
  settlement_status     text,
  notes                 text,
  created_at            timestamptz
)
language sql security definer
set search_path = public
as $$
  select
    audit_id, match_id, match_type, result,
    markets_settled, markets_skipped, failed_count,
    bets_affected, total_staked, total_winnings_paid, total_rake_collected,
    settlement_status, notes, created_at
  from bet_settlement_audit
  where created_at between p_from and p_to
  order by created_at desc;
$$;

create or replace function get_settlement_error_report(
  p_limit int default 100
)
returns table (
  error_id      uuid,
  audit_id      uuid,
  match_id      uuid,
  match_type    match_ref_type,
  market_id     uuid,
  bet_id        uuid,
  error_message text,
  retry_count   int,
  last_retry_at timestamptz,
  resolved_at   timestamptz,
  created_at    timestamptz
)
language sql security definer
set search_path = public
as $$
  select
    error_id, audit_id, match_id, match_type, market_id, bet_id,
    error_message, retry_count, last_retry_at, resolved_at, created_at
  from bet_settlement_errors
  order by resolved_at nulls first, created_at desc
  limit p_limit;
$$;
