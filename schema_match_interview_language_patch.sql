-- ============================================================
-- Add language to match_interviews
-- Lets a player choose English or Armenian before starting an AI
-- interview (app/championships/interviewActions.ts); the choice is
-- locked in at session creation and threaded into the OpenAI prompt
-- (lib/ai/interview.ts) for every turn of that session.
-- ============================================================

alter table match_interviews add column if not exists language text not null default 'en';

do $$ begin
  alter table match_interviews add constraint mi_language_check check (language in ('en', 'hy'));
exception when duplicate_object then null; end $$;
