-- 🗄️ CREAR TABLA HISTÓRICA DE CALCULADORA
-- Esta tabla almacena los valores archivados de cada período

CREATE TABLE IF NOT EXISTS calculator_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL,
  value DECIMAL(10,2) NOT NULL DEFAULT 0,
  period_date DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('1-15', '16-31')),
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  original_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_calculator_history_model_id ON calculator_history(model_id);
CREATE INDEX IF NOT EXISTS idx_calculator_history_period_date ON calculator_history(period_date);
CREATE INDEX IF NOT EXISTS idx_calculator_history_period_type ON calculator_history(period_type);
CREATE INDEX IF NOT EXISTS idx_calculator_history_archived_at ON calculator_history(archived_at);

-- Índice compuesto para consultas por modelo y período
CREATE INDEX IF NOT EXISTS idx_calculator_history_model_period ON calculator_history(model_id, period_date, period_type);

-- Comentarios para documentación
COMMENT ON TABLE calculator_history IS 'Historial de valores de calculadora archivados por período';
COMMENT ON COLUMN calculator_history.model_id IS 'ID del modelo propietario de los valores';
COMMENT ON COLUMN calculator_history.platform_id IS 'ID de la plataforma (ej: chaturbate, onlyfans)';
COMMENT ON COLUMN calculator_history.value IS 'Valor ingresado por el modelo en la plataforma';
COMMENT ON COLUMN calculator_history.period_date IS 'Fecha del período cuando se ingresaron los valores';
COMMENT ON COLUMN calculator_history.period_type IS 'Tipo de período: 1-15 (primera quincena) o 16-31 (segunda quincena)';
COMMENT ON COLUMN calculator_history.archived_at IS 'Fecha y hora cuando se archivaron los valores';
COMMENT ON COLUMN calculator_history.original_updated_at IS 'Fecha original de actualización del valor';

-- RLS (Row Level Security)
ALTER TABLE calculator_history ENABLE ROW LEVEL SECURITY;

-- Política: Los modelos solo pueden ver su propio historial
CREATE POLICY "Models can view own history" ON calculator_history
  FOR SELECT USING (auth.uid() = model_id);

-- Política: Admins pueden ver todo el historial
CREATE POLICY "Admins can view all history" ON calculator_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Política: Solo el sistema puede insertar (via service role)
CREATE POLICY "System can insert history" ON calculator_history
  FOR INSERT WITH CHECK (true);

-- Política: Nadie puede actualizar o eliminar historial
CREATE POLICY "No updates to history" ON calculator_history
  FOR UPDATE USING (false);

CREATE POLICY "No deletes to history" ON calculator_history
  FOR DELETE USING (false);
