-- =====================================================
-- 🔍 VERIFICACIÓN RÁPIDA: PERÍODO P1 DICIEMBRE 2025
-- =====================================================

-- 1. ¿Hay registros archivados en calculator_history?
SELECT 
  COUNT(*) as registros_archivados,
  COUNT(DISTINCT model_id) as modelos_archivados
FROM calculator_history
WHERE period_date = '2025-12-01'
  AND period_type = '1-15'
  AND archived_at IS NOT NULL;

-- 2. ¿Hay datos en model_values del período? (deberían estar vacíos si se cerró)
SELECT 
  COUNT(*) as valores_activos,
  COUNT(DISTINCT model_id) as modelos_con_valores
FROM model_values
WHERE period_date >= '2025-12-01'
  AND period_date <= '2025-12-15';

-- 3. ¿Cuál es el estado de cierre?
SELECT 
  period_date,
  period_type,
  status,
  completed_at
FROM calculator_period_closure_status
WHERE period_date = '2025-12-01'
  AND period_type = '1-15'
ORDER BY created_at DESC
LIMIT 1;

