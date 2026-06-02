-- =====================================================
-- 🛍️  AIM MARKET — PARADIGMA DE PASILLOS Y CATEGORÍAS
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- Crea la estructura relacional para agrupar categorías
-- bajo hermosos y organizados "Pasillos" (Aisles / Sections).
-- =====================================================

-- ── 1. Tabla de Pasillos (Aisles) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_aisles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  description         text,
  slug                text UNIQUE,
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES public.users(id),
  affiliate_studio_id uuid REFERENCES public.affiliate_studios(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Crear índice para la burbuja multi-tenant
CREATE INDEX IF NOT EXISTS idx_shop_aisles_affiliate ON shop_aisles(affiliate_studio_id);

-- ── 2. Agregar Relación en Categorías ────────────────────────────────
ALTER TABLE shop_categories ADD COLUMN IF NOT EXISTS aisle_id uuid REFERENCES shop_aisles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shop_categories_aisle ON shop_categories(aisle_id);

-- ── 3. Políticas de Seguridad RLS ───────────────────────────────────
ALTER TABLE shop_aisles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'shop_aisles' AND policyname = 'Authenticated can read aisles'
    ) THEN
        CREATE POLICY "Authenticated can read aisles" ON shop_aisles FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
END
$$;

-- ── 4. Triggers de updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_shop_aisles_upd ON shop_aisles;
CREATE TRIGGER trg_shop_aisles_upd BEFORE UPDATE ON shop_aisles FOR EACH ROW EXECUTE FUNCTION update_shop_updated_at();

-- ── 5. Recarga de Esquema PostgREST ───────────────────────────────
NOTIFY pgrst, 'reload schema';
