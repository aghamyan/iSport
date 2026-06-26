-- ============================================================
-- Shop / Products feature patch
-- Run in Supabase SQL editor
-- ============================================================

-- 1. Products table
CREATE TABLE IF NOT EXISTS products (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  tagline     text,
  description text,
  price       integer     NOT NULL DEFAULT 0,   -- price in AMD
  image_urls  text[]      NOT NULL DEFAULT '{}',
  category    text        NOT NULL DEFAULT 'APPAREL',
  badge       text,                             -- e.g. 'NEW', 'HOT', 'LIMITED', 'SALE'
  featured    boolean     NOT NULL DEFAULT false,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_products_updated_at();

-- 3. RLS — anyone authenticated can read active products; writes go through service role
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_public_select"
  ON products FOR SELECT
  USING (active = true);

-- 4. Storage bucket
-- Run this in the Supabase SQL editor OR create manually:
--   Dashboard → Storage → New bucket → name: "shop-photos", Public: true
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-photos', 'shop-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies — anyone can read; only service role writes (server actions)
CREATE POLICY "shop_photos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'shop-photos');

CREATE POLICY "shop_photos_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'shop-photos');

CREATE POLICY "shop_photos_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'shop-photos');

CREATE POLICY "shop_photos_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'shop-photos');
