-- PASO 2: Borrar el histórico P2 enero de calculator_history
DELETE FROM calculator_history
WHERE period_date = '2026-01-16'::date
  AND period_type = '16-31';
