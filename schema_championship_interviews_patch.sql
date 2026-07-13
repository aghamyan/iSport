-- ============================================================
-- iSport — AI Championship (Season-Wrap) Interviews
-- Apply AFTER: schema.sql, schema_auth.sql, schema_championships_patch.sql,
--              schema_stats_patch.sql
-- (Independent of schema_match_interviews_patch.sql — this file creates its
--  own copies of the shared interview_status/interview_role enums if they
--  don't already exist, so it can be applied on its own.)
--
-- One AI-journalist interview per (championship, player), offered once a
-- championship has finished (championships.is_active = false). Unlike the
-- match interviews, the journalist here has the whole campaign to work
-- with: every match in the championship, the final table, and the
-- player's P4P rating — not just one opponent.
--
-- final_rank/total_players/points/played/wins/draws/losses/goal_diff are a
-- snapshot of the player's finish taken when the interview is created, so
-- the public transcript page and the Telegram notification never need to
-- recompute standings later.
--
-- Writes always go through the service-role client from Server Actions
-- (app/championships/championshipInterviewActions.ts), which independently
-- verify the championship has finished and the caller was on its roster.
-- The RLS policies below are read-only defense-in-depth, not the primary
-- access control.
-- ============================================================

-- Idempotent guards throughout: this file is run by hand in the Supabase SQL
-- editor, so a partial run must be safely re-runnable from the top.
do $$ begin
  create type interview_status as enum ('in_progress', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interview_role as enum ('journalist', 'player');
exception when duplicate_object then null; end $$;

create table if not exists championship_interviews (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references championships(id) on delete cascade,
  player_id        uuid not null references players(id) on delete cascade,
  status           interview_status not null default 'in_progress',
  language         text not null default 'en' check (language in ('en', 'hy')),

  -- Snapshot of the player's final standing, taken at interview creation time.
  final_rank       smallint not null,
  total_players    smallint not null,
  points           smallint not null,
  played           smallint not null,
  wins             smallint not null,
  draws            smallint not null,
  losses           smallint not null,
  goal_diff        smallint not null,

  started_at       timestamptz not null default now(),
  completed_at     timestamptz,

  constraint ci_unique_championship_player unique (championship_id, player_id)
);

create index if not exists idx_ci_championship on championship_interviews(championship_id);
create index if not exists idx_ci_player on championship_interviews(player_id);

create table if not exists championship_interview_messages (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references championship_interviews(id) on delete cascade,
  role          interview_role not null,
  content       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_cim_interview on championship_interview_messages(interview_id, created_at);

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────
alter table championship_interviews         enable row level security;
alter table championship_interview_messages enable row level security;

drop policy if exists "own_or_admin_read" on championship_interviews;
create policy "own_or_admin_read" on championship_interviews for select
  using (
    player_id = auth.uid()
    or (select is_admin from users where id = auth.uid())
  );

drop policy if exists "own_or_admin_read" on championship_interview_messages;
create policy "own_or_admin_read" on championship_interview_messages for select
  using (
    exists (
      select 1 from championship_interviews ci
      where ci.id = championship_interview_messages.interview_id
        and (ci.player_id = auth.uid() or (select is_admin from users where id = auth.uid()))
    )
  );

comment on table championship_interviews is
  'One AI-journalist season-wrap interview per (championship, player), offered once '
  'championships.is_active = false. Enforced in app/championships/championshipInterviewActions.ts, '
  'not by a DB constraint.';

comment on table championship_interview_messages is
  'Turn-by-turn transcript for a championship_interviews session. role=journalist is AI-generated '
  '(OpenAI), role=player is the participant''s typed reply.';
