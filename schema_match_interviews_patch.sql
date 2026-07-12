-- ============================================================
-- iSport — AI Match Interviews
-- Apply AFTER: schema.sql, schema_auth.sql, schema_championships_patch.sql,
--              schema_stats_patch.sql
--
-- Pre-match and post-match "AI journalist" interviews tied to a
-- championship match. One match_interviews row per (match, player, phase).
-- Messages live in a separate table so the admin panel can list/order them
-- independently of the parent session row.
--
-- Writes always go through the service-role client from Server Actions
-- (app/championships/interviewActions.ts), which independently verify the
-- caller is a participant in the match and that the match status matches
-- the requested phase (pending -> pre_match, confirmed/final -> post_match).
-- The RLS policies below are read-only defense-in-depth, not the primary
-- access control.
-- ============================================================

-- Idempotent guards throughout: this file is run by hand in the Supabase SQL
-- editor, so a partial run must be safely re-runnable from the top.
do $$ begin
  create type interview_phase as enum ('pre_match', 'post_match');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interview_status as enum ('in_progress', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interview_role as enum ('journalist', 'player');
exception when duplicate_object then null; end $$;

create table if not exists match_interviews (
  id                    uuid primary key default gen_random_uuid(),
  championship_match_id uuid not null references championship_matches(id) on delete cascade,
  player_id             uuid not null references players(id) on delete cascade,
  phase                 interview_phase not null,
  status                interview_status not null default 'in_progress',
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,

  constraint mi_unique_match_player_phase unique (championship_match_id, player_id, phase)
);

create index if not exists idx_mi_match  on match_interviews(championship_match_id);
create index if not exists idx_mi_player on match_interviews(player_id);

create table if not exists match_interview_messages (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references match_interviews(id) on delete cascade,
  role          interview_role not null,
  content       text not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_mim_interview on match_interview_messages(interview_id, created_at);

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────
alter table match_interviews         enable row level security;
alter table match_interview_messages enable row level security;

drop policy if exists "own_or_admin_read" on match_interviews;
create policy "own_or_admin_read" on match_interviews for select
  using (
    player_id = auth.uid()
    or (select is_admin from users where id = auth.uid())
  );

drop policy if exists "own_or_admin_read" on match_interview_messages;
create policy "own_or_admin_read" on match_interview_messages for select
  using (
    exists (
      select 1 from match_interviews mi
      where mi.id = match_interview_messages.interview_id
        and (mi.player_id = auth.uid() or (select is_admin from users where id = auth.uid()))
    )
  );

comment on table match_interviews is
  'One AI-journalist interview session per (championship match, player, pre/post phase). '
  'phase=pre_match requires the match to still be pending; phase=post_match requires a '
  'recorded result. Enforced in app/championships/interviewActions.ts, not by a DB constraint.';

comment on table match_interview_messages is
  'Turn-by-turn transcript for a match_interviews session. role=journalist is AI-generated '
  '(OpenAI), role=player is the participant''s typed reply.';
