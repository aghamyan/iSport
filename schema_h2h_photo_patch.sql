-- H2H Photos: admin-uploaded combined player banner photos, keyed by sorted player pair
create table if not exists h2h_photos (
  id          uuid        primary key default gen_random_uuid(),
  player1_id  uuid        not null references users(id) on delete cascade,
  player2_id  uuid        not null references users(id) on delete cascade,
  photo_url   text        not null,
  created_at  timestamptz not null default now(),
  -- always store the lesser UUID as player1_id so the pair is order-independent
  constraint h2h_photos_pair_order  check (player1_id < player2_id),
  constraint h2h_photos_unique_pair unique (player1_id, player2_id)
);

-- Enable RLS (read-only public, service role writes)
alter table h2h_photos enable row level security;
create policy "h2h_photos_read" on h2h_photos for select using (true);

-- Storage bucket must be created manually in Supabase dashboard:
-- Name: h2h-photos  |  Public: true
