-- =====================================================
-- 🔄 RECREAR ESQUEMA COMPLETO DE CALCULADORA
-- =====================================================

-- 1. ELIMINAR tablas existentes de calculadora (sin afectar otras)
DROP TABLE IF EXISTS calculator_config CASCADE;
DROP TABLE IF EXISTS calculator_platforms CASCADE;
DROP TABLE IF EXISTS model_values CASCADE;

-- 2. CREAR tabla de plataformas (catálogo)
CREATE TABLE calculator_platforms (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  currency text NOT NULL,
  token_rate numeric(10,4) NULL,
  discount_factor numeric(10,4) NULL,
  tax_rate numeric(10,4) NULL,
  direct_payout boolean NOT NULL DEFAULT FALSE,
  active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. CREAR tabla de configuración admin→modelo
CREATE TABLE calculator_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id uuid NULL,
  
  -- Configuración de plataformas habilitadas
  enabled_platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  
  -- Configuración de reparto y cuota
  percentage_override numeric(5,2) NULL,
  min_quota_override numeric(18,2) NULL,
  group_percentage numeric(5,2) NULL,
  group_min_quota numeric(18,2) NULL,
  
  -- Metadatos
  active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. CREAR tabla de valores ingresados por modelo
CREATE TABLE model_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform_id text NOT NULL REFERENCES calculator_platforms(id) ON DELETE CASCADE,
  value numeric(18,2) NOT NULL DEFAULT 0,
  period_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Una entrada por modelo/plataforma/período
  UNIQUE(model_id, platform_id, period_date)
);

-- 5. ÍNDICES para optimización
CREATE INDEX calculator_platforms_active_idx ON calculator_platforms (active);
CREATE INDEX calculator_config_model_id_idx ON calculator_config (model_id);
CREATE INDEX calculator_config_admin_id_idx ON calculator_config (admin_id);
CREATE INDEX calculator_config_active_idx ON calculator_config (active);
CREATE INDEX model_values_model_id_idx ON model_values (model_id);
CREATE INDEX model_values_platform_id_idx ON model_values (platform_id);
CREATE INDEX model_values_period_idx ON model_values (period_date);

-- 6. RLS para calculator_platforms
ALTER TABLE calculator_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can read calculator_platforms" ON calculator_platforms FOR SELECT USING (true);
CREATE POLICY "Admins can manage calculator_platforms" ON calculator_platforms FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 7. RLS para calculator_config
ALTER TABLE calculator_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Models can view their own calculator_config" ON calculator_config FOR SELECT USING (auth.uid() = model_id);
CREATE POLICY "Admins can manage calculator_config" ON calculator_config FOR ALL USING (
  auth.uid() = admin_id OR 
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 8. RLS para model_values
ALTER TABLE model_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Models can manage their own values" ON model_values FOR ALL USING (auth.uid() = model_id);
CREATE POLICY "Admins can view model_values" ON model_values FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- 9. INSERTAR las 25 plataformas
INSERT INTO calculator_platforms (id, name, description, currency, token_rate, discount_factor, tax_rate, direct_payout) VALUES
-- EUR→USD→COP (8 plataformas)
('big7', 'BIG7', 'EUR a USD con 16% impuesto', 'EUR', NULL, NULL, 0.16, FALSE),
('mondo', 'MONDO', 'EUR a USD con factor 0.78', 'EUR', NULL, 0.78, NULL, FALSE),
('modelka', 'MODELKA', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),
('xmodels', 'XMODELS', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),
('777', '777', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),
('vx', 'VX', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),
('livecreator', 'LIVECREATOR', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),
('mow', 'MOW', 'EUR a USD', 'EUR', NULL, NULL, NULL, FALSE),

-- USD→USD→COP (9 plataformas)
('cmd', 'CMD', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE),
('camlust', 'CAMLUST', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE),
('skypvt', 'SKYPVT', 'USD a USD con factor 0.75', 'USD', NULL, 0.75, NULL, FALSE),
('livejasmin', 'LIVEJASMIN', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),
('mdh', 'MDH', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),
('imlive', 'IMLIVE', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),
('hegre', 'HEGRE', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),
('dirtyfans', 'DIRTYFANS', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),
('camcontacts', 'CAMCONTACTS', 'USD directo', 'USD', NULL, NULL, NULL, FALSE),

-- GBP→USD→COP (2 plataformas)
('aw', 'AW', 'GBP a USD con factor 0.677', 'GBP', NULL, 0.677, NULL, FALSE),
('babestation', 'BABESTATION', 'GBP a USD', 'GBP', NULL, NULL, NULL, FALSE),

-- Tokens→USD→COP (4 plataformas)
('chaturbate', 'Chaturbate', 'Tokens a USD (100 tokens = 5 USD)', 'USD', 0.05, NULL, NULL, FALSE),
('myfreecams', 'MyFreeCams', 'Tokens a USD (100 tokens = 5 USD)', 'USD', 0.05, NULL, NULL, FALSE),
('stripchat', 'Stripchat', 'Tokens a USD (100 tokens = 5 USD)', 'USD', 0.05, NULL, NULL, FALSE),
('dxlive', 'DX Live', 'Puntos a USD (100 pts = 60 USD)', 'USD', 0.60, NULL, NULL, FALSE),

-- Créditos→USD→COP (1 plataforma)
('secretfriends', 'SECRETFRIENDS', 'Créditos con factor 0.5', 'USD', NULL, 0.5, NULL, FALSE),

-- Pago directo (1 plataforma)
('superfoon', 'SUPERFOON', 'Pago directo 100%', 'USD', NULL, NULL, NULL, TRUE);

-- 10. VERIFICAR que se insertaron todas las plataformas
SELECT COUNT(*) as total_platforms FROM calculator_platforms;
SELECT 'Schema recreado exitosamente' as status;
