-- =====================================================
-- 🛍️  AIM SEXSHOP — ESQUEMA COMPLETO
-- =====================================================

-- ── 1. Categorías (crea el super admin) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  slug        text UNIQUE,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Productos ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id         uuid REFERENCES shop_categories(id) ON DELETE SET NULL,
  name                text NOT NULL,
  description         text,
  base_price          numeric(18,2) NOT NULL CHECK (base_price >= 0),
  images              text[] DEFAULT '{}',           -- URLs de Supabase Storage
  allow_financing     boolean NOT NULL DEFAULT true, -- false = solo contado
  min_stock_alert     int NOT NULL DEFAULT 2,        -- alerta al llegar a este nº
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Variantes (talla, color, etc. — opcionales) ─────────────────────────
CREATE TABLE IF NOT EXISTS shop_product_variants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  name        text NOT NULL,    -- ej. "Talla S / Rojo"
  sku         text,
  price_delta numeric(18,2) NOT NULL DEFAULT 0, -- diferencia vs base_price
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 4. Inventario por ubicación ─────────────────────────────────────────────
-- location_type: 'bodega' (super admin) | 'sede' (group_id)
CREATE TABLE IF NOT EXISTS shop_inventory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  variant_id      uuid REFERENCES shop_product_variants(id) ON DELETE CASCADE,
  location_type   text NOT NULL CHECK (location_type IN ('bodega','sede')),
  location_id     uuid,   -- NULL para bodega, group_id para sedes
  quantity        int NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved        int NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, variant_id, location_type, location_id)
);

-- ── 5. Promociones ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_promotions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  type         text NOT NULL CHECK (type IN ('percentage','fixed','2x1','category')),
  value        numeric(18,2),             -- % o monto fijo; NULL para 2x1
  product_id   uuid REFERENCES shop_products(id) ON DELETE CASCADE,
  category_id  uuid REFERENCES shop_categories(id) ON DELETE CASCADE,
  min_quantity int DEFAULT 1,
  starts_at    timestamptz,
  ends_at      timestamptz,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES public.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── 6. Pedidos (cabecera) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id         uuid NOT NULL REFERENCES public.users(id),
  status           text NOT NULL DEFAULT 'pendiente'
                     CHECK (status IN ('pendiente','reservado','aprobado',
                                       'en_preparacion','entregado','cancelado','expirado')),
  subtotal         numeric(18,2) NOT NULL,
  discount_amount  numeric(18,2) NOT NULL DEFAULT 0,
  total            numeric(18,2) NOT NULL,
  payment_mode     text NOT NULL CHECK (payment_mode IN ('1q','2q','3q','4q')),
  -- 1q: pago único esta quincena; 2-4q: financiación (requiere aprobación admin)
  notes            text,
  approved_by      uuid REFERENCES public.users(id),
  approved_at      timestamptz,
  rejected_by      uuid REFERENCES public.users(id),
  rejected_at      timestamptz,
  delivered_at     timestamptz,
  delivered_by     uuid REFERENCES public.users(id),  -- admin o modelo
  cancelled_at     timestamptz,
  cancelled_by     uuid REFERENCES public.users(id),
  reservation_expires_at timestamptz,  -- 48h para pedidos pendientes de aprobación
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── 7. Líneas del pedido ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id       uuid NOT NULL REFERENCES shop_products(id),
  variant_id       uuid REFERENCES shop_product_variants(id),
  quantity         int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price       numeric(18,2) NOT NULL,   -- precio final con descuento aplicado
  original_price   numeric(18,2) NOT NULL,   -- precio sin descuento
  discount_applied numeric(18,2) NOT NULL DEFAULT 0,
  promotion_id     uuid REFERENCES shop_promotions(id),
  -- de qué ubicación sale el stock
  source_location_type text CHECK (source_location_type IN ('bodega','sede')),
  source_location_id   uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── 8. Financiación ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_financing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL UNIQUE REFERENCES shop_orders(id) ON DELETE CASCADE,
  model_id        uuid NOT NULL REFERENCES public.users(id),
  total_amount    numeric(18,2) NOT NULL,
  installments    int NOT NULL CHECK (installments BETWEEN 1 AND 4),
  amount_per_installment numeric(18,2) NOT NULL,
  status          text NOT NULL DEFAULT 'pendiente'
                    CHECK (status IN ('pendiente','aprobado','rechazado','completado','cancelado')),
  approved_by     uuid REFERENCES public.users(id),
  approved_at     timestamptz,
  rejected_by     uuid REFERENCES public.users(id),
  rejected_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── 9. Cuotas individuales de financiación ──────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_financing_installments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financing_id     uuid NOT NULL REFERENCES shop_financing(id) ON DELETE CASCADE,
  installment_no   int NOT NULL,          -- 1, 2, 3, 4
  period_id        uuid REFERENCES public.periods(id),
  amount           numeric(18,2) NOT NULL,
  status           text NOT NULL DEFAULT 'pendiente'
                     CHECK (status IN ('pendiente','cobrada','prorrogada','reintegrada')),
  prorogued_count  int NOT NULL DEFAULT 0,
  deducted_at      timestamptz,
  deducted_by      uuid REFERENCES public.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── 10. Traslados de stock entre ubicaciones ────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_stock_transfers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES shop_products(id),
  variant_id            uuid REFERENCES shop_product_variants(id),
  from_location_type    text NOT NULL CHECK (from_location_type IN ('bodega','sede')),
  from_location_id      uuid,
  to_location_type      text NOT NULL CHECK (to_location_type IN ('bodega','sede')),
  to_location_id        uuid,
  quantity              int NOT NULL CHECK (quantity > 0),
  notes                 text,
  transferred_by        uuid NOT NULL REFERENCES public.users(id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shop_products_category   ON shop_products(category_id);
CREATE INDEX IF NOT EXISTS idx_shop_products_active     ON shop_products(is_active);
CREATE INDEX IF NOT EXISTS idx_shop_inventory_product   ON shop_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_shop_inventory_location  ON shop_inventory(location_type, location_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_model        ON shop_orders(model_id);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status       ON shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_expires      ON shop_orders(reservation_expires_at) WHERE status = 'reservado';
CREATE INDEX IF NOT EXISTS idx_shop_financing_model     ON shop_financing(model_id);
CREATE INDEX IF NOT EXISTS idx_shop_financing_status    ON shop_financing(status);
CREATE INDEX IF NOT EXISTS idx_shop_installments_period ON shop_financing_installments(period_id);
CREATE INDEX IF NOT EXISTS idx_shop_promotions_active   ON shop_promotions(is_active, starts_at, ends_at);

-- ── Triggers updated_at ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_shop_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER trg_shop_categories_upd   BEFORE UPDATE ON shop_categories            FOR EACH ROW EXECUTE FUNCTION update_shop_updated_at();
CREATE OR REPLACE TRIGGER trg_shop_products_upd     BEFORE UPDATE ON shop_products               FOR EACH ROW EXECUTE FUNCTION update_shop_updated_at();
CREATE OR REPLACE TRIGGER trg_shop_inventory_upd    BEFORE UPDATE ON shop_inventory              FOR EACH ROW EXECUTE FUNCTION update_shop_updated_at();
CREATE OR REPLACE TRIGGER trg_shop_orders_upd       BEFORE UPDATE ON shop_orders                 FOR EACH ROW EXECUTE FUNCTION update_shop_updated_at();
CREATE OR REPLACE TRIGGER trg_shop_financing_upd    BEFORE UPDATE ON shop_financing              FOR EACH ROW EXECUTE FUNCTION update_shop_updated_at();
CREATE OR REPLACE TRIGGER trg_shop_installments_upd BEFORE UPDATE ON shop_financing_installments FOR EACH ROW EXECUTE FUNCTION update_shop_updated_at();

-- ── RLS (service role bypasses all policies) ─────────────────────────────────
ALTER TABLE shop_categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_product_variants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_inventory              ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_promotions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_financing              ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_financing_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_stock_transfers        ENABLE ROW LEVEL SECURITY;

-- Lectura pública autenticada para catálogo
CREATE POLICY "Authenticated can read shop catalog" ON shop_products    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read categories"   ON shop_categories  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read variants"     ON shop_product_variants FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can read promotions"   ON shop_promotions  FOR SELECT USING (auth.role() = 'authenticated');
-- Todo lo demás (órdenes, inventario, financiación) se gestiona desde el servidor con service_role
CREATE POLICY "Service role manages orders"      ON shop_orders                 FOR ALL USING (true);
CREATE POLICY "Service role manages inventory"   ON shop_inventory              FOR ALL USING (true);
CREATE POLICY "Service role manages order_items" ON shop_order_items            FOR ALL USING (true);
CREATE POLICY "Service role manages financing"   ON shop_financing              FOR ALL USING (true);
CREATE POLICY "Service role manages installments" ON shop_financing_installments FOR ALL USING (true);
CREATE POLICY "Service role manages transfers"   ON shop_stock_transfers        FOR ALL USING (true);
