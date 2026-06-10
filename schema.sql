-- ============================================================
-- FC26 / FC27 Match Tracking Platform — Database Schema
-- Target: Supabase (PostgreSQL)
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- ENUMS
-- ──────────────────────────────────────────────────────────────
create type match_status   as enum ('pending', 'confirmed', 'final');
create type odds_type      as enum ('friendly', 'championship');
create type rivalry_status as enum ('active', 'completed');
create type champ_format   as enum ('round_robin');


-- ──────────────────────────────────────────────────────────────
-- USERS & PLAYERS
-- ──────────────────────────────────────────────────────────────
create table users (
  id           uuid primary key default gen_random_uuid(),
  access_code  text unique not null,
  name         text not null,
  avatar_url   text,
  is_active    boolean not null default true,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- 1:1 with users; denormalized stats for O(1) reads
create table players (
  id             uuid primary key references users(id) on delete cascade,
  display_name   text,
  goals_for      int  not null default 0,
  goals_against  int  not null default 0,
  wins           int  not null default 0,
  losses         int  not null default 0,
  draws          int  not null default 0,
  matches_played int  generated always as (wins + losses + draws) stored,
  goal_diff      int  generated always as (goals_for - goals_against) stored,
  updated_at     timestamptz not null default now()
);

create index idx_users_access_code on users(access_code);
create index idx_users_active      on users(is_active) where is_active = true;


-- ──────────────────────────────────────────────────────────────
-- FRIENDLY MATCHES
-- ──────────────────────────────────────────────────────────────
create table friendly_matches (
  id              uuid primary key default gen_random_uuid(),
  home_player_id  uuid not null references players(id) on delete restrict,
  away_player_id  uuid not null references players(id) on delete restrict,
  home_score      smallint,
  away_score      smallint,
  notes           text,
  status          match_status not null default 'pending',
  created_by      uuid not null references users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  confirmed_at    timestamptz,

  constraint fm_different_players    check (home_player_id <> away_player_id),
  constraint fm_scores_when_confirmed check (
    status = 'pending'
    or (home_score is not null and away_score is not null)
  )
);

create index idx_fm_home     on friendly_matches(home_player_id);
create index idx_fm_away     on friendly_matches(away_player_id);
create index idx_fm_status   on friendly_matches(status);
create index idx_fm_created  on friendly_matches(created_at desc);
create index idx_fm_deadline on friendly_matches(confirmed_at)
  where status = 'confirmed';

-- Enforce 4-hour edit window atomically at the DB level
create or replace function prevent_late_edit()
returns trigger language plpgsql as $$
begin
  if old.status = 'confirmed'
     and now() > old.confirmed_at + interval '4 hours'
     and not (select is_admin from users where id = auth.uid())
  then
    raise exception 'Edit window has expired';
  end if;
  return new;
end;
$$;

create trigger trg_friendly_edit_window
  before update on friendly_matches
  for each row execute function prevent_late_edit();


-- ──────────────────────────────────────────────────────────────
-- CHAMPIONSHIPS
-- ──────────────────────────────────────────────────────────────
create table championships (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  format           champ_format not null default 'round_robin',
  number_of_cycles smallint not null default 1,
  created_by       uuid not null references users(id) on delete restrict,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create table championship_players (
  championship_id  uuid not null references championships(id) on delete cascade,
  player_id        uuid not null references players(id) on delete restrict,
  joined_at        timestamptz not null default now(),
  primary key (championship_id, player_id)
);

create table championship_matches (
  id               uuid primary key default gen_random_uuid(),
  championship_id  uuid not null references championships(id) on delete cascade,
  home_player_id   uuid not null references players(id) on delete restrict,
  away_player_id   uuid not null references players(id) on delete restrict,
  home_score       smallint,
  away_score       smallint,
  cycle            smallint not null default 1,
  status           match_status not null default 'pending',
  confirmed_at     timestamptz,
  played_at        timestamptz,
  created_at       timestamptz not null default now(),
  constraint cm_different_players check (home_player_id <> away_player_id)
);

-- Denormalized standings — updated by trigger on match finalization
create table championship_standings (
  championship_id  uuid not null references championships(id) on delete cascade,
  player_id        uuid not null references players(id) on delete restrict,
  played           int not null default 0,
  wins             int not null default 0,
  draws            int not null default 0,
  losses           int not null default 0,
  goals_for        int not null default 0,
  goals_against    int not null default 0,
  points           int generated always as (wins * 3 + draws) stored,
  goal_diff        int generated always as (goals_for - goals_against) stored,
  updated_at       timestamptz not null default now(),
  primary key (championship_id, player_id)
);

create index idx_cm_championship on championship_matches(championship_id);
create index idx_cm_home         on championship_matches(home_player_id);
create index idx_cm_away         on championship_matches(away_player_id);
create index idx_cm_status       on championship_matches(status);
-- Required for Supabase Realtime row-level filtering
alter table championship_matches replica identity full;


-- ──────────────────────────────────────────────────────────────
-- PERSONAL RIVALRIES
-- ──────────────────────────────────────────────────────────────
create table rivalries (
  id            uuid primary key default gen_random_uuid(),
  -- canonical ordering (smaller uuid = player1) prevents duplicate pairs
  player1_id    uuid not null references players(id) on delete restrict,
  player2_id    uuid not null references players(id) on delete restrict,
  best_of       smallint not null,
  player1_wins  int not null default 0,
  player2_wins  int not null default 0,
  winner_id     uuid references players(id),
  status        rivalry_status not null default 'active',
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,

  constraint rv_different_players check (player1_id <> player2_id),
  constraint rv_canonical_order   check (player1_id < player2_id),
  constraint rv_unique_pair       unique (player1_id, player2_id)
);

create table rivalry_matches (
  rivalry_id   uuid not null references rivalries(id) on delete cascade,
  match_id     uuid not null references friendly_matches(id) on delete cascade,
  primary key (rivalry_id, match_id)
);

create index idx_rivalries_p1 on rivalries(player1_id);
create index idx_rivalries_p2 on rivalries(player2_id);


-- ──────────────────────────────────────────────────────────────
-- MATCH ODDS
-- ──────────────────────────────────────────────────────────────
create table match_odds (
  id                    uuid primary key default gen_random_uuid(),
  odds_type             odds_type not null,
  -- Separate FKs instead of unsafe polymorphic ID
  friendly_match_id     uuid references friendly_matches(id) on delete cascade,
  championship_match_id uuid references championship_matches(id) on delete cascade,
  home_win_odds         numeric(5,2),
  draw_odds             numeric(5,2),
  away_win_odds         numeric(5,2),
  home_handicap         numeric(4,1),
  away_handicap         numeric(4,1),
  home_stats_snapshot   jsonb,
  away_stats_snapshot   jsonb,
  calculated_at         timestamptz not null default now(),

  constraint odds_exactly_one_match check (
    (friendly_match_id is null) <> (championship_match_id is null)
  )
);

create index idx_odds_friendly     on match_odds(friendly_match_id);
create index idx_odds_championship on match_odds(championship_match_id);


-- ──────────────────────────────────────────────────────────────
-- BADGES
-- ──────────────────────────────────────────────────────────────
create table badges (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  description  text,
  icon_url     text,
  badge_type   text not null  -- 'rivalry_won', 'streak', 'milestone', etc.
);

create table player_badges (
  id                 uuid primary key default gen_random_uuid(),
  player_id          uuid not null references players(id) on delete cascade,
  badge_id           uuid not null references badges(id) on delete cascade,
  earned_at          timestamptz not null default now(),
  source_rivalry_id  uuid references rivalries(id) on delete set null,
  source_match_id    uuid,  -- loose ref, no FK (match may be deleted)
  unique (player_id, badge_id)
);

create index idx_player_badges on player_badges(player_id);


-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (Supabase)
-- ──────────────────────────────────────────────────────────────
alter table players                enable row level security;
alter table friendly_matches       enable row level security;
alter table championship_matches   enable row level security;
alter table championship_standings enable row level security;
alter table rivalries              enable row level security;

create policy "read_all" on players                for select using (true);
create policy "read_all" on friendly_matches       for select using (true);
create policy "read_all" on championship_matches   for select using (true);
create policy "read_all" on championship_standings for select using (true);
create policy "read_all" on rivalries              for select using (true);

create policy "own_match_insert" on friendly_matches for insert
  with check (
    home_player_id = auth.uid() or away_player_id = auth.uid()
  );

create policy "admin_delete_fm" on friendly_matches for delete
  using ((select is_admin from users where id = auth.uid()));

create policy "admin_delete_cm" on championship_matches for delete
  using ((select is_admin from users where id = auth.uid()));
