-- =====================================================
-- 🔄 RECREAR ESQUEMA COMPLETO DE TASAS
-- =====================================================

-- 1. ELIMINAR tabla existente de tasas (sin afectar otras)
DROP TABLE IF EXISTS rates CASCADE;

-- 2. CREAR tabla de tasas optimizada
CREATE TABLE rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL, -- USD→COP, EUR→USD, GBP→USD
  value numeric(18,4) NOT NULL, -- Valor de la tasa
  scope text NOT NULL DEFAULT 'global', -- global, group, model
  scope_id uuid NULL, -- ID del grupo o modelo (si aplica)
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Vigencia de la tasa
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz NULL, -- NULL = activa, fecha = inactiva
  
  -- Metadatos
  active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Una tasa activa por tipo/alcance
  UNIQUE(kind, scope, scope_id, valid_to)
);

-- 3. ÍNDICES para optimización
CREATE INDEX rates_kind_idx ON rates (kind);
CREATE INDEX rates_scope_idx ON rates (scope);
CREATE INDEX rates_scope_id_idx ON rates (scope_id);
CREATE INDEX rates_valid_from_idx ON rates (valid_from);
CREATE INDEX rates_valid_to_idx ON rates (valid_to);
CREATE INDEX rates_active_idx ON rates (active);

-- 4. RLS para rates
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;

-- Política para que todos puedan leer tasas activas
CREATE POLICY "Everyone can read active rates" ON rates FOR SELECT USING (
  active = true AND valid_to IS NULL
);

-- Política para que admins puedan gestionar tasas
CREATE POLICY "Admins can manage rates" ON rates FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  )
);

-- 5. INSERTAR tasas por defecto
INSERT INTO rates (kind, value, scope, author_id, valid_from) VALUES
('USD→COP', 3900.0000, 'global', (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1), now()),
('EUR→USD', 1.0100, 'global', (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1), now()),
('GBP→USD', 1.2000, 'global', (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1), now());

-- 6. VERIFICAR que se insertaron las tasas
SELECT COUNT(*) as total_rates FROM rates;
SELECT kind, value, scope, valid_from FROM rates ORDER BY kind;

-- 7. VERIFICAR tasas activas
SELECT 
  kind,
  value,
  scope,
  valid_from,
  valid_to
FROM rates 
WHERE active = true 
AND valid_to IS NULL
ORDER BY kind;

SELECT 'Schema de tasas recreado exitosamente' as status;
