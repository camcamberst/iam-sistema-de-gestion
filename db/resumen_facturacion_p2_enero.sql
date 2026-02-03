-- =====================================================
-- RESUMEN DE FACTURACIÓN - P2 ENERO (16-31 enero 2026)
-- =====================================================
-- Genera el mismo resumen que "Consulta Histórica" para
-- el período P2 de enero, a partir de calculator_history
-- (datos del cierre de período).
-- Ejecutar en Supabase SQL Editor.
-- =====================================================

-- Totales por modelo (excluye __CONSOLIDATED_TOTAL__, una fila por plataforma)
WITH detalle AS (
  SELECT
    ch.model_id,
    ch.platform_id,
    ch.value_usd_bruto,
    ch.value_usd_modelo,
    ch.value_cop_modelo
  FROM calculator_history ch
  WHERE ch.period_date = '2026-01-16'::date
    AND ch.period_type = '16-31'
    AND ch.platform_id IS DISTINCT FROM '__CONSOLIDATED_TOTAL__'
),
-- Una sola fila por (model_id, platform_id) por si hubiera duplicados
dedup AS (
  SELECT DISTINCT ON (model_id, platform_id)
    model_id,
    platform_id,
    value_usd_bruto,
    value_usd_modelo,
    value_cop_modelo
  FROM detalle
  ORDER BY model_id, platform_id
),
totales_por_modelo AS (
  SELECT
    model_id,
    SUM(COALESCE(value_usd_bruto, 0))   AS total_usd_bruto,
    SUM(COALESCE(value_usd_modelo, 0))  AS total_usd_modelo,
    SUM(COALESCE(value_cop_modelo, 0))  AS total_cop_modelo
  FROM dedup
  GROUP BY model_id
)
SELECT
  u.id AS model_id,
  u.name AS modelo_nombre,
  u.email AS modelo_email,
  ROUND(COALESCE(t.total_usd_bruto, 0), 2)   AS usd_bruto,
  ROUND(COALESCE(t.total_usd_modelo, 0), 2)  AS usd_modelo,
  COALESCE(t.total_cop_modelo, 0)            AS cop_modelo,
  ROUND(COALESCE(t.total_usd_bruto, 0) - COALESCE(t.total_usd_modelo, 0), 2) AS usd_sede_agencia
FROM totales_por_modelo t
JOIN users u ON u.id = t.model_id
ORDER BY u.name;

-- =====================================================
-- TOTALES GENERALES (pie del resumen)
-- =====================================================
WITH detalle AS (
  SELECT
    ch.model_id,
    ch.platform_id,
    ch.value_usd_bruto,
    ch.value_usd_modelo,
    ch.value_cop_modelo
  FROM calculator_history ch
  WHERE ch.period_date = '2026-01-16'::date
    AND ch.period_type = '16-31'
    AND ch.platform_id IS DISTINCT FROM '__CONSOLIDATED_TOTAL__'
),
dedup AS (
  SELECT DISTINCT ON (model_id, platform_id)
    model_id, platform_id, value_usd_bruto, value_usd_modelo, value_cop_modelo
  FROM detalle
  ORDER BY model_id, platform_id
)
SELECT
  COUNT(DISTINCT model_id) AS total_modelos,
  ROUND(SUM(COALESCE(value_usd_bruto, 0)), 2)   AS total_usd_bruto,
  ROUND(SUM(COALESCE(value_usd_modelo, 0)), 2)  AS total_usd_modelo,
  SUM(COALESCE(value_cop_modelo, 0))            AS total_cop_modelo,
  ROUND(SUM(COALESCE(value_usd_bruto, 0)) - SUM(COALESCE(value_usd_modelo, 0)), 2) AS total_usd_sede_agencia
FROM dedup;
