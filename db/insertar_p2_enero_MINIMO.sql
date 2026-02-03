-- =====================================================
-- P2 ENERO: INSERT MÍNIMO (solo columnas básicas, sin estado)
-- =====================================================
-- Usa SOLO: model_id, period_date, period_type, platform_id, value.
-- Si al ejecutar da error de columna, pega el mensaje.
-- =====================================================

-- PREVIA: ¿Cuántas filas se insertarían? (solo lectura)
WITH agregado AS (
  SELECT model_id, platform_id, SUM(COALESCE(value, 0)::numeric) AS total_value
  FROM model_values
  WHERE period_date >= '2026-01-16'::date AND period_date <= '2026-01-31'::date
  GROUP BY model_id, platform_id
)
SELECT COUNT(*) AS filas_a_insertar_por_plataforma FROM agregado;

-- 1) Insertar por plataforma (sin columna estado)
WITH agregado AS (
  SELECT model_id, platform_id, SUM(COALESCE(value, 0)::numeric) AS total_value
  FROM model_values
  WHERE period_date >= '2026-01-16'::date AND period_date <= '2026-01-31'::date
  GROUP BY model_id, platform_id
)
INSERT INTO calculator_history (model_id, period_date, period_type, platform_id, value)
SELECT a.model_id, '2026-01-16'::date, '16-31', a.platform_id, a.total_value
FROM agregado a
WHERE NOT EXISTS (
  SELECT 1 FROM calculator_history ch
  WHERE ch.model_id = a.model_id AND ch.platform_id = a.platform_id
    AND ch.period_date = '2026-01-16'::date AND ch.period_type = '16-31'
);

-- 2) Insertar total consolidado por modelo (sin columna estado)
WITH totales AS (
  SELECT model_id, SUM(COALESCE(value, 0)::numeric) AS total_value
  FROM model_values
  WHERE period_date >= '2026-01-16'::date AND period_date <= '2026-01-31'::date
  GROUP BY model_id
)
INSERT INTO calculator_history (model_id, period_date, period_type, platform_id, value)
SELECT t.model_id, '2026-01-16'::date, '16-31', '__CONSOLIDATED_TOTAL__', COALESCE(t.total_value, 0)
FROM totales t
WHERE NOT EXISTS (
  SELECT 1 FROM calculator_history ch
  WHERE ch.model_id = t.model_id AND ch.period_date = '2026-01-16'::date
    AND ch.period_type = '16-31' AND ch.platform_id = '__CONSOLIDATED_TOTAL__'
);
