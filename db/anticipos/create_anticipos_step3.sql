-- =====================================================
-- 📋 PASO 3: Crear índices y triggers
-- =====================================================

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_anticipos_model_id ON anticipos(model_id);
CREATE INDEX IF NOT EXISTS idx_anticipos_period_id ON anticipos(period_id);
CREATE INDEX IF NOT EXISTS idx_anticipos_estado ON anticipos(estado);
CREATE INDEX IF NOT EXISTS idx_anticipos_created_at ON anticipos(created_at);
CREATE INDEX IF NOT EXISTS idx_anticipos_model_period ON anticipos(model_id, period_id);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_anticipos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER trigger_update_anticipos_updated_at
  BEFORE UPDATE ON anticipos
  FOR EACH ROW
  EXECUTE FUNCTION update_anticipos_updated_at();

