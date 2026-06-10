-- Adds group_playoff format: single group stage → top 4 → 2 single-leg semis → final
ALTER TYPE champ_format ADD VALUE IF NOT EXISTS 'group_playoff';
