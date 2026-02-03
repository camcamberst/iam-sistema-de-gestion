-- =====================================================
-- DIAGNÓSTICO P2 ENERO — Ejecuta esto PRIMERO en Supabase
-- =====================================================
-- Copia y ejecuta cada bloque. Los resultados dirán si hay datos
-- y con qué period_date están guardados.
-- =====================================================

-- A) ¿Cuántos registros hay en model_values para 2026-01-16?
SELECT
  'model_values (period_date = 2026-01-16)' AS consulta,
  COUNT(*) AS registros,
  COUNT(DISTINCT model_id) AS modelos
FROM model_values
WHERE period_date = '2026-01-16'::date;

-- B) Si A dio 0: ¿qué period_date tienen los datos de enero 2026?
SELECT
  period_date,
  COUNT(*) AS registros,
  COUNT(DISTINCT model_id) AS modelos
FROM model_values
WHERE period_date >= '2026-01-01'::date
  AND period_date <= '2026-01-31'::date
GROUP BY period_date
ORDER BY period_date;

-- C) ¿Hay algo en calculator_totals para 2026-01-16?
SELECT
  'calculator_totals (2026-01-16)' AS consulta,
  COUNT(*) AS registros
FROM calculator_totals
WHERE period_date = '2026-01-16'::date;
