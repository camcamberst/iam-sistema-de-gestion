-- =====================================================
-- P2 ENERO: Insertar a calculator_history desde model_values
-- usando CUALQUIER period_date de enero 2026 (16 al 31)
-- =====================================================
-- Si tus datos están con 2026-01-17, 2026-01-31, etc.,
-- este script los copia todos como P2 enero (2026-01-16, 16-31).
-- Ejecuta en Supabase SQL Editor.
-- =====================================================

-- PASO 0: Ver qué period_date tienes en enero 2026 (solo lectura)
SELECT period_date, COUNT(*) AS registros, COUNT(DISTINCT model_id) AS modelos
FROM model_values
WHERE period_date >= '2026-01-16'::date
  AND period_date <= '2026-01-31'::date
GROUP BY period_date
ORDER BY period_date;

-- PASO 1: Insertar por plataforma (SUM de value por model_id + platform_id en 16–31 ene)
-- Una fila por (modelo, plataforma) con el total del período
WITH agregado AS (
  SELECT
    model_id,
    platform_id,
    SUM(COALESCE(value, 0)::numeric) AS total_value
  FROM model_values
  WHERE period_date >= '2026-01-16'::date
    AND period_date <= '2026-01-31'::date
  GROUP BY model_id, platform_id
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
  a.model_id,
  '2026-01-16'::date,
  '16-31',
  a.platform_id,
  a.total_value,
  'auditado'
FROM agregado a
WHERE NOT EXISTS (
  SELECT 1 FROM calculator_history ch
  WHERE ch.model_id = a.model_id
    AND ch.platform_id = a.platform_id
    AND ch.period_date = '2026-01-16'::date
    AND ch.period_type = '16-31'
);

-- PASO 2: Insertar total consolidado por modelo (SUM de value)
WITH totales AS (
  SELECT
    model_id,
    SUM(COALESCE(value, 0)::numeric) AS total_value
  FROM model_values
  WHERE period_date >= '2026-01-16'::date
    AND period_date <= '2026-01-31'::date
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
