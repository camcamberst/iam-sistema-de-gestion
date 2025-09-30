-- =====================================================
-- 🧩 MIGRACIÓN NO DESTRUCTIVA A MODEL_VALUES V2
-- Objetivo: habilitar upsert por (model_id, platform_id, period_date)
-- Sin borrar datos existentes ni afectar otras tablas.
-- Ejecutar en Supabase SQL Editor.
-- Idempotente: puede ejecutarse múltiples veces.
-- =====================================================

-- 1) Agregar columnas si no existen
ALTER TABLE model_values
  ADD COLUMN IF NOT EXISTS platform_id text,
  ADD COLUMN IF NOT EXISTS period_date date DEFAULT CURRENT_DATE;

-- 2) Backfill de platform_id desde la columna antigua "platform" si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'model_values' AND column_name = 'platform'
  ) THEN
    UPDATE model_values
    SET platform_id = COALESCE(platform_id, platform)
    WHERE platform_id IS NULL AND platform IS NOT NULL;
  END IF;
END $$;

-- 3) Crear FK hacia calculator_platforms(id) si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'model_values_platform_id_fkey'
  ) THEN
    ALTER TABLE model_values
      ADD CONSTRAINT model_values_platform_id_fkey
      FOREIGN KEY (platform_id) REFERENCES calculator_platforms(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4) Crear índice único compuesto para upsert seguro (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uniq_model_values_model_platform_period'
  ) THEN
    CREATE UNIQUE INDEX uniq_model_values_model_platform_period
      ON model_values (model_id, platform_id, period_date);
  END IF;
END $$;

-- 5) Índices de apoyo
CREATE INDEX IF NOT EXISTS model_values_period_idx ON model_values (period_date);
CREATE INDEX IF NOT EXISTS model_values_platform_id_idx ON model_values (platform_id);

-- 6) RLS (asegurar políticas mínimas)
ALTER TABLE model_values ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'model_values' AND policyname = 'Models can manage their own values'
  ) THEN
    CREATE POLICY "Models can manage their own values" ON model_values
      FOR ALL USING (auth.uid() = model_id);
  END IF;
END $$;

-- 7) Verificación rápida
SELECT 'OK' AS status,
       COUNT(*) FILTER (WHERE platform_id IS NULL) AS rows_missing_platform_id,
       COUNT(*) AS total_rows
FROM model_values;


