-- =====================================================
-- 📊 TABLA: calculator_config
-- Configuración individual de calculadora por modelo
-- =====================================================

CREATE TABLE IF NOT EXISTS calculator_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- Quien configuró
  group_id uuid NULL, -- Grupo de la modelo (referencia manual)
  
  -- Configuración de plataformas (JSON)
  enabled_platforms jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array de IDs de plataformas habilitadas
  
  -- Configuración de reparto y cuota
  percentage_override numeric(5,2) NULL, -- NULL = usar valor del grupo, valor = override personalizado
  min_quota_override numeric(18,2) NULL, -- NULL = usar valor del grupo, valor = override personalizado
  
  -- Configuración por grupo (valores base)
  group_percentage numeric(5,2) NULL, -- Porcentaje por defecto del grupo
  group_min_quota numeric(18,2) NULL, -- Cuota mínima por defecto del grupo
  
  -- Metadatos
  active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
  
  -- Una configuración activa por modelo
  -- Nota: La restricción de unicidad se manejará a nivel de aplicación
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS calculator_config_model_id_idx ON calculator_config (model_id);
CREATE INDEX IF NOT EXISTS calculator_config_admin_id_idx ON calculator_config (admin_id);
CREATE INDEX IF NOT EXISTS calculator_config_group_id_idx ON calculator_config (group_id);
CREATE INDEX IF NOT EXISTS calculator_config_active_idx ON calculator_config (active);

-- RLS para calculator_config
ALTER TABLE calculator_config ENABLE ROW LEVEL SECURITY;

-- Política para que las modelos solo puedan ver su propia configuración
DROP POLICY IF EXISTS "Models can view their own calculator_config." ON calculator_config;
CREATE POLICY "Models can view their own calculator_config."
  ON calculator_config FOR SELECT
  USING (auth.uid() = model_id);

-- Política para que los admins puedan ver y modificar configuraciones de modelos en sus grupos
DROP POLICY IF EXISTS "Admins can manage calculator_config of models in their groups." ON calculator_config;
CREATE POLICY "Admins can manage calculator_config of models in their groups."
  ON calculator_config FOR ALL
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin' OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin' OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- Política para que los super_admins puedan ver y modificar todas las configuraciones
DROP POLICY IF EXISTS "Super Admins can manage all calculator_config." ON calculator_config;
CREATE POLICY "Super Admins can manage all calculator_config."
  ON calculator_config FOR ALL
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin')
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'super_admin');

-- Trigger para actualizar `updated_at` automáticamente
CREATE OR REPLACE FUNCTION update_calculator_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_calculator_config_updated_at ON calculator_config;
CREATE TRIGGER set_calculator_config_updated_at
BEFORE UPDATE ON calculator_config
FOR EACH ROW
EXECUTE FUNCTION update_calculator_config_updated_at();

-- =====================================================
-- 📊 TABLA: calculator_platforms
-- Catálogo de plataformas disponibles
-- =====================================================

CREATE TABLE IF NOT EXISTS calculator_platforms (
  id text PRIMARY KEY, -- 'chaturbate', 'myfreecams', etc.
  name text NOT NULL, -- 'Chaturbate', 'MyFreeCams', etc.
  description text NULL,
  currency text NOT NULL DEFAULT 'USD', -- Moneda base de la plataforma
  token_rate numeric(18,4) NULL, -- Tasa de conversión de tokens (ej: 100 tokens = 5 USD)
  discount_factor numeric(5,4) NULL, -- Factor de descuento (ej: 0.75 para 25% descuento)
  tax_rate numeric(5,4) NULL, -- Tasa de impuesto (ej: 0.16 para 16% impuesto)
  direct_payout boolean NOT NULL DEFAULT FALSE, -- Si paga directamente 100% (ej: SUPERFOON)
  active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insertar plataformas por defecto
INSERT INTO calculator_platforms (id, name, description, currency, token_rate, discount_factor, tax_rate, direct_payout) VALUES
('chaturbate', 'Chaturbate', 'Tokens a USD', 'USD', 0.05, NULL, NULL, FALSE),
('myfreecams', 'MyFreeCams', 'Tokens a USD', 'USD', 0.05, NULL, NULL, FALSE),
('stripchat', 'Stripchat', 'Tokens a USD', 'USD', 0.05, NULL, NULL, FALSE),
('dxlive', 'DX Live', 'Puntos a USD (60 centavos por 100 pts)', 'USD', 0.60, NULL, NULL, FALSE),
('big7', 'BIG7', 'EUR a USD con 16% impuesto', 'EUR', NULL, NULL, 0.16, FALSE),
('aw', 'AW', 'GBP a USD con factor 0.677', 'GBP', NULL, 0.677, NULL, FALSE),
('babestation', 'BABESTATION', 'GBP a USD', 'GBP', NULL, NULL, NULL, FALSE),
('mondo', 'MONDO', 'EUR a USD con factor 0.78', 'EUR', NULL, 0.78, NULL, FALSE),
('cmd', 'CMD', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE),
('camlust', 'CAMLUST', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE),
('skypvt', 'SKYPVT', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE),
('secretfriends', 'SECRETFRIENDS', 'Créditos con factor 0.5', 'USD', NULL, 0.5, NULL, FALSE),
('superfoon', 'SUPERFOON', 'Pago directo 100%', 'USD', NULL, NULL, NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

-- RLS para calculator_platforms (lectura pública)
ALTER TABLE calculator_platforms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view active calculator_platforms." ON calculator_platforms;
CREATE POLICY "Everyone can view active calculator_platforms."
  ON calculator_platforms FOR SELECT
  USING (active = true);
