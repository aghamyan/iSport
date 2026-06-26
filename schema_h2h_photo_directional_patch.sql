-- Make H2H photos directional: A vs B and B vs A can have separate photos.
-- Drop the CHECK constraint that enforced sorted order; keep the unique pair constraint.
alter table h2h_photos drop constraint if exists h2h_photos_pair_order;

-- Existing rows were stored with sorted (lesser < greater) IDs.
-- They remain valid and will be returned when the matching direction is queried.
