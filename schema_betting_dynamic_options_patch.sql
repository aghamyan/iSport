-- Dynamic betting market option support.
-- Enables markets such as Exact Score to expose option4+ while preserving
-- validation that every placed/settled option is an "optionN" key.

alter table bet_markets drop constraint if exists bet_markets_result_check;
alter table bets drop constraint if exists bets_selected_option_check;
alter table parlay_legs drop constraint if exists parlay_legs_selected_option_check;

alter table bet_markets
  add constraint bet_markets_result_dynamic_option
  check (result is null or result ~ '^option[0-9]+$');

alter table bets
  add constraint bets_selected_option_dynamic_option
  check (selected_option is null or selected_option ~ '^option[0-9]+$');

alter table parlay_legs
  add constraint parlay_legs_selected_option_dynamic_option
  check (selected_option ~ '^option[0-9]+$');

create or replace function settle_market(
  p_market_id      uuid,
  p_winning_option text,
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

  update bet_markets
  set status     = 'SETTLED',
      result     = p_winning_option,
      settled_at = now(),
      settled_by = p_admin_id
  where market_id = p_market_id;

  update parlay_legs
  set result     = case
                     when selected_option = p_winning_option then 'WON'::leg_result
                     else                                         'LOST'::leg_result
                   end,
      settled_at = now()
  where market_id = p_market_id;

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
