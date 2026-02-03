-- PASO 1: Ver cuántos registros de P2 enero se van a borrar (solo lectura)
SELECT
  COUNT(*) AS registros_a_borrar,
  COUNT(DISTINCT model_id) AS modelos_afectados
FROM calculator_history
WHERE period_date = '2026-01-16'::date
  AND period_type = '16-31';
