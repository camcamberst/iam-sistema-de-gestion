-- PASO 3: Verificar que quedaron 0 registros de P2 enero
SELECT COUNT(*) AS registros_p2_enero
FROM calculator_history
WHERE period_date = '2026-01-16'::date
  AND period_type = '16-31';
