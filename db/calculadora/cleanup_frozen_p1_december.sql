-- 🧹 LIMPIAR REGISTROS DE EARLY FREEZE DEL PERÍODO P1 DICIEMBRE (2025-12-15)
-- Este período ya fue cerrado pero los registros de early freeze no se limpiaron

-- 1. Verificar si el período está cerrado
SELECT 
  period_date,
  period_type,
  status,
  completed_at
FROM calculator_period_closure_status
WHERE period_date = '2025-12-15'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Ver cuántos registros hay que limpiar
SELECT 
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_afectados,
  COUNT(DISTINCT platform_id) as plataformas_afectadas
FROM calculator_early_frozen_platforms
WHERE period_date = '2025-12-15';

-- 3. Ver una muestra de los registros
SELECT 
  model_id,
  platform_id,
  frozen_at
FROM calculator_early_frozen_platforms
WHERE period_date = '2025-12-15'
ORDER BY frozen_at DESC
LIMIT 20;

-- 4. LIMPIAR REGISTROS DEL PERÍODO 2025-12-15 (EJECUTAR ESTO)
-- IMPORTANTE: Estos registros NO contienen valores históricos, solo información de congelamiento
-- No se perderá información histórica al eliminarlos
DELETE FROM calculator_early_frozen_platforms
WHERE period_date = '2025-12-15';

-- 5. LIMPIAR TODOS LOS REGISTROS DE PERÍODOS CERRADOS (RECOMENDADO - MÁS COMPLETO)
-- Esto limpia todos los registros de períodos que ya fueron cerrados
-- IMPORTANTE: Estos registros NO contienen valores históricos, solo información de congelamiento
-- La información histórica real está en calculator_history y calculator_totals
DELETE FROM calculator_early_frozen_platforms
WHERE period_date IN (
  SELECT DISTINCT period_date 
  FROM calculator_period_closure_status 
  WHERE status = 'completed'
);

-- 6. VERIFICAR QUE SE LIMPIARON CORRECTAMENTE
SELECT 
  period_date,
  COUNT(*) as registros_restantes
FROM calculator_early_frozen_platforms
WHERE period_date = '2025-12-15'
GROUP BY period_date;

