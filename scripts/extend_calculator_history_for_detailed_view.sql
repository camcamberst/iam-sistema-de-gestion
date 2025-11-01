-- 📊 AMPLIAR TABLA calculator_history PARA MOSTRAR COMPACTO DE MI CALCULADORA
-- Agregar columnas para tasas, porcentajes y cálculos aplicados

-- Agregar columnas para tasas de cambio aplicadas
ALTER TABLE calculator_history
  ADD COLUMN IF NOT EXISTS rate_eur_usd DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS rate_gbp_usd DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS rate_usd_cop DECIMAL(10,4);

-- Agregar columnas para porcentajes y cálculos
ALTER TABLE calculator_history
  ADD COLUMN IF NOT EXISTS platform_percentage DECIMAL(5,2), -- Porcentaje aplicado a la plataforma (ej: 80%)
  ADD COLUMN IF NOT EXISTS value_usd_bruto DECIMAL(10,2), -- Valor en USD después de conversión de moneda pero ANTES del porcentaje
  ADD COLUMN IF NOT EXISTS value_usd_modelo DECIMAL(10,2), -- Valor en USD después de aplicar porcentaje (USD bruto × porcentaje)
  ADD COLUMN IF NOT EXISTS value_cop_modelo DECIMAL(10,2); -- Valor en COP (USD modelo × tasa USD_COP)

-- Comentarios para documentación
COMMENT ON COLUMN calculator_history.rate_eur_usd IS 'Tasa de cambio EUR→USD aplicada al momento del archivo';
COMMENT ON COLUMN calculator_history.rate_gbp_usd IS 'Tasa de cambio GBP→USD aplicada al momento del archivo';
COMMENT ON COLUMN calculator_history.rate_usd_cop IS 'Tasa de cambio USD→COP aplicada al momento del archivo';
COMMENT ON COLUMN calculator_history.platform_percentage IS 'Porcentaje de reparto aplicado a esta plataforma (ej: 80%)';
COMMENT ON COLUMN calculator_history.value_usd_bruto IS 'Valor convertido a USD después de aplicar tasas de cambio, pero antes del porcentaje';
COMMENT ON COLUMN calculator_history.value_usd_modelo IS 'Valor final en USD después de aplicar porcentaje de reparto';
COMMENT ON COLUMN calculator_history.value_cop_modelo IS 'Valor final en COP (USD modelo × tasa USD_COP)';

-- Índice para optimizar consultas por período con cálculos
CREATE INDEX IF NOT EXISTS idx_calculator_history_period_calculations 
  ON calculator_history(period_date, period_type, model_id);

-- Permitir edición para admins (modificar política RLS)
-- Primero eliminar la política restrictiva de UPDATE
DROP POLICY IF EXISTS "No updates to history" ON calculator_history;

-- Crear política que permite a admins actualizar valores y tasas para correcciones
CREATE POLICY "Admins can update history for corrections" ON calculator_history
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

