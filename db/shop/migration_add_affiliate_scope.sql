-- =====================================================
-- 🔒 SEXSHOP — Separación por negocio (affiliate_studio_id)
-- =====================================================
-- Ejecutar en Supabase SQL Editor
-- Aplica el mismo principio de "burbuja de datos" del resto del sistema:
--   NULL → Agencia Innova
--   UUID → Estudio afiliado específico
-- =====================================================

-- 1. Categorías
ALTER TABLE shop_categories
  ADD COLUMN IF NOT EXISTS affiliate_studio_id uuid
    REFERENCES affiliate_studios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_shop_categories_affiliate
  ON shop_categories(affiliate_studio_id);

-- 2. Productos
ALTER TABLE shop_products
  ADD COLUMN IF NOT EXISTS affiliate_studio_id uuid
    REFERENCES affiliate_studios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_shop_products_affiliate
  ON shop_products(affiliate_studio_id);

-- 3. Promociones
ALTER TABLE shop_promotions
  ADD COLUMN IF NOT EXISTS affiliate_studio_id uuid
    REFERENCES affiliate_studios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_shop_promotions_affiliate
  ON shop_promotions(affiliate_studio_id);

-- 4. Pedidos (se hereda del modelo al crear; útil para filtrar directo)
ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS affiliate_studio_id uuid
    REFERENCES affiliate_studios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_shop_orders_affiliate
  ON shop_orders(affiliate_studio_id);

-- =====================================================
-- Los datos existentes (si los hay) se dejan con NULL
-- → quedan asignados a Agencia Innova automáticamente
-- =====================================================
