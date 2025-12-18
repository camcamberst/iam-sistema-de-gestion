-- =====================================================
-- 🔍 DIAGNÓSTICO: PERÍODO P1 DICIEMBRE 2025
-- =====================================================
-- Verificar si el período se cerró y qué datos existen
-- =====================================================

-- 1. Verificar estado de cierre en calculator_period_closure_status
SELECT 
  period_date,
  period_type,
  status,
  started_at,
  completed_at,
  error_message,
  current_step,
  total_steps
FROM calculator_period_closure_status
WHERE period_date >= '2025-12-01'
  AND period_date <= '2025-12-31'
  AND period_type = '1-15'
ORDER BY started_at DESC
LIMIT 5;

-- 2. Verificar si hay registros en calculator_history (sin filtro de archived_at)
SELECT 
  period_date,
  period_type,
  COUNT(*) as total_registros,
  COUNT(archived_at) as con_archived_at,
  COUNT(*) FILTER (WHERE archived_at IS NULL) as sin_archived_at,
  MIN(archived_at) as primer_archivo,
  MAX(archived_at) as ultimo_archivo
FROM calculator_history
WHERE period_type = '1-15'
  AND period_date >= '2025-12-01'
  AND period_date <= '2025-12-31'
GROUP BY period_date, period_type;

-- 3. Verificar si hay datos en calculator_totals para reconstruir
-- NOTA: calculator_totals puede no tener period_type, verificar estructura primero
SELECT 
  period_date,
  COUNT(*) as total_registros,
  SUM(value) as total_value,
  MIN(period_date) as fecha_minima,
  MAX(period_date) as fecha_maxima
FROM calculator_totals
WHERE period_date >= '2025-12-01'
  AND period_date <= '2025-12-31'
GROUP BY period_date
ORDER BY period_date;

-- 4. Verificar si hay datos en model_values del período (deberían estar vacíos si se cerró)
SELECT 
  COUNT(*) as total_valores,
  COUNT(DISTINCT model_id) as modelos_con_valores,
  MIN(period_date) as fecha_minima,
  MAX(period_date) as fecha_maxima
FROM model_values
WHERE period_date >= '2025-12-01'
  AND period_date <= '2025-12-15';

-- 5. Verificar modelos activos que deberían tener datos archivados
SELECT 
  COUNT(*) as modelos_activos
FROM users
WHERE role = 'modelo'
  AND is_active = true;

