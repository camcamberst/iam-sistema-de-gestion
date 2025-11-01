-- =====================================================
-- 🔄 NUEVO SISTEMA DE CIERRE DE PERÍODOS
-- =====================================================
-- Tablas para rastrear estados de cierre y plataformas congeladas
-- =====================================================

-- Tabla: Estados del proceso de cierre
CREATE TABLE IF NOT EXISTS calculator_period_closure_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_date date NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('1-15', '16-31')),
  status text NOT NULL CHECK (status IN (
    'pending', 
    'early_freezing', 
    'closing_calculators',
    'waiting_summary',
    'closing_summary',
    'archiving',
    'completed',
    'failed'
  )),
  current_step integer DEFAULT 0,
  total_steps integer DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closure_status_period_date ON calculator_period_closure_status(period_date);
CREATE INDEX IF NOT EXISTS idx_closure_status_status ON calculator_period_closure_status(status);
CREATE INDEX IF NOT EXISTS idx_closure_status_created_at ON calculator_period_closure_status(created_at DESC);

-- Tabla: Plataformas congeladas anticipadamente
CREATE TABLE IF NOT EXISTS calculator_early_frozen_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_date date NOT NULL,
  model_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_id text NOT NULL,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_date, model_id, platform_id)
);

CREATE INDEX IF NOT EXISTS idx_frozen_platforms_period_date ON calculator_early_frozen_platforms(period_date);
CREATE INDEX IF NOT EXISTS idx_frozen_platforms_model_id ON calculator_early_frozen_platforms(model_id);
CREATE INDEX IF NOT EXISTS idx_frozen_platforms_platform_id ON calculator_early_frozen_platforms(platform_id);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_closure_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_closure_status_updated_at
  BEFORE UPDATE ON calculator_period_closure_status
  FOR EACH ROW
  EXECUTE FUNCTION update_closure_status_updated_at();

-- RLS (Row Level Security)
ALTER TABLE calculator_period_closure_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculator_early_frozen_platforms ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Lectura pública (todos pueden ver estados)
CREATE POLICY "Anyone can read closure status"
  ON calculator_period_closure_status
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert/update closure status"
  ON calculator_period_closure_status
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Anyone can read frozen platforms"
  ON calculator_early_frozen_platforms
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage frozen platforms"
  ON calculator_early_frozen_platforms
  FOR ALL
  USING (auth.role() = 'service_role');

-- Comentarios para documentación
COMMENT ON TABLE calculator_period_closure_status IS 'Rastrea el estado del proceso de cierre de períodos de calculadora';
COMMENT ON TABLE calculator_early_frozen_platforms IS 'Registra plataformas congeladas anticipadamente (medianoche Europa Central)';
COMMENT ON COLUMN calculator_period_closure_status.status IS 'Estado actual del proceso de cierre';
COMMENT ON COLUMN calculator_period_closure_status.metadata IS 'Datos adicionales del proceso (logs, errores, etc.)';

