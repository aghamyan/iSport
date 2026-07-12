-- ============================================================
-- iSport — AI Match Preview
-- Apply AFTER: schema.sql, schema_auth.sql, schema_championships_patch.sql,
--              schema_stats_patch.sql, schema_match_interviews_patch.sql
--
-- One AI-generated preview per championship match, written by an LLM from
-- standings, H2H, form, P4P, odds, past championships, and pre-match
-- interview quotes for that match. Generated lazily — only when a viewer
-- clicks "AI Preview" in the match preview modal (app/championships/
-- aiPreviewActions.ts) — then cached here so it's a one-time OpenAI call
-- per match, not one per view.
--
-- Writes always go through the service-role client from Server Actions,
-- which independently verify the caller is authenticated. The RLS policy
-- below is read-only defense-in-depth, not the primary access control
-- (same convention as schema_match_interviews_patch.sql).
-- ============================================================

-- Idempotent guards throughout: this file is run by hand in the Supabase SQL
-- editor, so a partial run must be safely re-runnable from the top.
create table if not exists match_ai_previews (
  id                    uuid primary key default gen_random_uuid(),
  championship_match_id uuid not null references championship_matches(id) on delete cascade,
  headline              text not null,
  summary               text not null,
  insights              jsonb not null,
  generated_at          timestamptz not null default now(),

  constraint map_unique_match unique (championship_match_id)
);

create index if not exists idx_map_match on match_ai_previews(championship_match_id);

-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────
alter table match_ai_previews enable row level security;

drop policy if exists "read_all" on match_ai_previews;
create policy "read_all" on match_ai_previews for select using (true);

comment on table match_ai_previews is
  'Cached AI-generated pre-match preview (headline + summary + insights) for a '
  'championship match. Generated on first "AI Preview" click, then reused for '
  'every subsequent viewer of that match instead of regenerating.';
