-- ============================================================
-- iSport — Championships: edit-window trigger + Realtime support
-- Apply AFTER schema.sql, schema_auth.sql, schema_matches_patch.sql
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- Edit-window trigger on championship_matches
-- Reuses prevent_late_edit() from schema.sql — the function is
-- table-agnostic: it only reads old.status, old.confirmed_at,
-- and auth.uid() from the users table.
-- ──────────────────────────────────────────────────────────────
create trigger trg_champ_edit_window
  before update on championship_matches
  for each row execute function prevent_late_edit();


-- ──────────────────────────────────────────────────────────────
-- Supabase Realtime — enable row-level event streaming
-- replica identity full is already set in schema.sql;
-- publication membership is a separate step.
-- ──────────────────────────────────────────────────────────────
alter publication supabase_realtime add table championship_matches;
alter publication supabase_realtime add table championships;
