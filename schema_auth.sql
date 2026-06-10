-- ============================================================
-- iSport — Auth & missing RLS additions
-- Apply AFTER schema.sql
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- SESSIONS
-- ──────────────────────────────────────────────────────────────
create table sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '30 days'
);

create index idx_sessions_user    on sessions(user_id);
create index idx_sessions_expires on sessions(expires_at);

-- Only the service role touches this table (no public RLS policies needed)
alter table sessions enable row level security;


-- ──────────────────────────────────────────────────────────────
-- MISSING WRITE POLICIES  (schema.sql only had SELECT + 2 deletes)
-- ──────────────────────────────────────────────────────────────

-- Friendly matches: allow the match creator to update within edit window
-- (prevent_late_edit trigger enforces the 4-hour hard limit)
create policy "own_match_update" on friendly_matches for update
  using  (created_by = auth.uid() or (select is_admin from users where id = auth.uid()))
  with check (created_by = auth.uid() or (select is_admin from users where id = auth.uid()));

-- Championships: admin-only create/update/delete
alter table championships enable row level security;

create policy "read_all" on championships for select using (true);

create policy "admin_championships_insert" on championships for insert
  with check ((select is_admin from users where id = auth.uid()));

create policy "admin_championships_update" on championships for update
  using  ((select is_admin from users where id = auth.uid()))
  with check ((select is_admin from users where id = auth.uid()));

create policy "admin_championships_delete" on championships for delete
  using  ((select is_admin from users where id = auth.uid()));

-- Championship matches: participant or admin can insert/update
create policy "participant_cm_insert" on championship_matches for insert
  with check (
    home_player_id = auth.uid() or away_player_id = auth.uid()
    or (select is_admin from users where id = auth.uid())
  );

create policy "participant_cm_update" on championship_matches for update
  using (
    home_player_id = auth.uid() or away_player_id = auth.uid()
    or (select is_admin from users where id = auth.uid())
  )
  with check (
    home_player_id = auth.uid() or away_player_id = auth.uid()
    or (select is_admin from users where id = auth.uid())
  );

-- Championship players: admin-only roster management
alter table championship_players enable row level security;

create policy "read_all" on championship_players for select using (true);

create policy "admin_cp_insert" on championship_players for insert
  with check ((select is_admin from users where id = auth.uid()));

create policy "admin_cp_delete" on championship_players for delete
  using  ((select is_admin from users where id = auth.uid()));

-- Users table: public read, admin-only write
alter table users enable row level security;

create policy "read_all"  on users for select using (true);

create policy "admin_users_insert" on users for insert
  with check ((select is_admin from users where id = auth.uid()));

create policy "admin_users_update" on users for update
  using  ((select is_admin from users where id = auth.uid()))
  with check ((select is_admin from users where id = auth.uid()));

-- Players table: public read, admin/self write
create policy "admin_players_insert" on players for insert
  with check ((select is_admin from users where id = auth.uid()));

create policy "admin_or_self_players_update" on players for update
  using  (id = auth.uid() or (select is_admin from users where id = auth.uid()))
  with check (id = auth.uid() or (select is_admin from users where id = auth.uid()));
