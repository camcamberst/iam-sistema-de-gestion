-- 🔍 VERIFICAR REGISTROS DE PLATAFORMAS CONGELADAS
-- Este script ayuda a diagnosticar por qué las plataformas siguen bloqueadas

-- 1. Ver todos los registros de early freeze (últimos 30 días)
SELECT 
  id,
  period_date,
  model_id,
  platform_id,
  frozen_at,
  created_at
FROM calculator_early_frozen_platforms
WHERE frozen_at >= NOW() - INTERVAL '30 days'
ORDER BY frozen_at DESC
LIMIT 100;

-- 2. Contar registros por período
SELECT 
  period_date,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicos,
  COUNT(DISTINCT platform_id) as plataformas_unicas,
  MIN(frozen_at) as primer_congelamiento,
  MAX(frozen_at) as ultimo_congelamiento
FROM calculator_early_frozen_platforms
WHERE frozen_at >= NOW() - INTERVAL '30 days'
GROUP BY period_date
ORDER BY period_date DESC;

-- 3. Ver registros de un modelo específico (reemplazar MODEL_ID)
-- SELECT 
--   period_date,
--   platform_id,
--   frozen_at
-- FROM calculator_early_frozen_platforms
-- WHERE model_id = 'MODEL_ID'
-- ORDER BY frozen_at DESC;

-- 4. Verificar si hay registros de períodos ya cerrados
SELECT 
  efp.period_date,
  efp.model_id,
  efp.platform_id,
  efp.frozen_at,
  cps.period_type,
  cps.status as closure_status
FROM calculator_early_frozen_platforms efp
LEFT JOIN calculator_period_closure_status cps 
  ON efp.period_date = cps.period_date
WHERE efp.frozen_at >= NOW() - INTERVAL '30 days'
  AND cps.status = 'completed'
ORDER BY efp.frozen_at DESC;

-- 5. LIMPIAR registros de períodos ya cerrados (EJECUTAR CON CUIDADO)
-- DELETE FROM calculator_early_frozen_platforms
-- WHERE period_date IN (
--   SELECT DISTINCT period_date 
--   FROM calculator_period_closure_status 
--   WHERE status = 'completed'
-- );

-- 6. LIMPIAR TODOS los registros antiguos (más de 7 días) - EJECUTAR CON CUIDADO
-- DELETE FROM calculator_early_frozen_platforms
-- WHERE frozen_at < NOW() - INTERVAL '7 days';

