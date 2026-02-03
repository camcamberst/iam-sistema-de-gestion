-- =====================================================
-- EJECUTAR: Copiar P2 enero de model_values → calculator_history
-- =====================================================
-- Pega y ejecuta en Supabase SQL Editor (todo el archivo o por bloques).
-- No borra model_values; solo inserta en calculator_history.
-- =====================================================

-- 1. Insertar registros por plataforma (solo los que no existen)
-- Nota: Solo columnas que existen en tu calculator_history (sin created_by, batch_id, metadata)
INSERT INTO calculator_history (
  model_id,
  period_date,
  period_type,
  platform_id,
  value,
  estado
)
SELECT
  mv.model_id,
  '2026-01-16'::date,
  '16-31',
  mv.platform_id,
  mv.value,
  'auditado'
FROM model_values mv
WHERE mv.period_date = '2026-01-16'::date
  AND NOT EXISTS (
    SELECT 1 FROM calculator_history ch
    WHERE ch.model_id = mv.model_id
      AND ch.platform_id = mv.platform_id
      AND ch.period_date = '2026-01-16'::date
      AND ch.period_type = '16-31'
  );

-- 2. Insertar totales consolidados por modelo (total = SUM(value) desde model_values, sin usar calculator_totals)
WITH totales AS (
  SELECT
    model_id,
    SUM(COALESCE(value, 0)::numeric) AS total_value
  FROM model_values
  WHERE period_date = '2026-01-16'::date
  GROUP BY model_id
)
INSERT INTO calculator_history (
  model_id,
  period_date,
  period_type,
  platform_id,
  value,
  estado
)
SELECT
  t.model_id,
  '2026-01-16'::date,
  '16-31',
  '__CONSOLIDATED_TOTAL__',
  COALESCE(t.total_value, 0),
  'auditado'
FROM totales t
WHERE NOT EXISTS (
  SELECT 1 FROM calculator_history ch
  WHERE ch.model_id = t.model_id
    AND ch.period_date = '2026-01-16'::date
    AND ch.period_type = '16-31'
    AND ch.platform_id = '__CONSOLIDATED_TOTAL__'
);
