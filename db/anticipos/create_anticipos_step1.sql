-- =====================================================
-- 📋 PASO 1: Crear tabla periods
-- =====================================================

-- Crear tabla periods si no existe
CREATE TABLE IF NOT EXISTS periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, -- "Enero 2024 - Período 1", "Enero 2024 - Período 2"
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Crear índice para periods
CREATE INDEX IF NOT EXISTS idx_periods_active ON periods(is_active);
CREATE INDEX IF NOT EXISTS idx_periods_dates ON periods(start_date, end_date);

-- Insertar períodos actuales (ejemplo)
INSERT INTO periods (name, start_date, end_date, is_active) VALUES
  ('Diciembre 2024 - Período 1', '2024-12-01', '2024-12-15', true),
  ('Diciembre 2024 - Período 2', '2024-12-16', '2024-12-31', false)
ON CONFLICT DO NOTHING;

