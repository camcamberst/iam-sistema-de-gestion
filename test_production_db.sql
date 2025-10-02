-- 🔍 TEST: Verificar base de datos de PRODUCCIÓN
-- 
-- Este script debe ejecutarse en el entorno de producción para verificar:
-- 1. Si los valores se están guardando correctamente
-- 2. Si se están cargando correctamente
-- 3. Si hay problemas de fechas o timezone

-- 1. Verificar estructura de tabla model_values
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'model_values' 
ORDER BY ordinal_position;

-- 2. Verificar TODOS los valores para el modelo específico
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at,
  created_at
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
ORDER BY updated_at DESC, platform_id;

-- 3. Verificar valores por fecha específica (hoy Europa Central)
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date = (CURRENT_DATE AT TIME ZONE 'Europe/Berlin')::date
ORDER BY platform_id;

-- 4. Verificar si hay valores duplicados
SELECT 
  model_id,
  platform_id,
  period_date,
  COUNT(*) as count
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
GROUP BY model_id, platform_id, period_date
HAVING COUNT(*) > 1;

-- 5. Verificar valores más recientes (últimas 2 horas)
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND updated_at >= NOW() - INTERVAL '2 hours'
ORDER BY updated_at DESC;

-- 6. Verificar fechas de períodos disponibles
SELECT DISTINCT 
  period_date,
  COUNT(*) as values_count,
  MAX(updated_at) as last_updated
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
GROUP BY period_date
ORDER BY period_date DESC;

-- 7. Verificar si hay conflictos de timezone
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at,
  EXTRACT(TIMEZONE FROM updated_at) as timezone_offset,
  NOW() as server_time,
  (CURRENT_DATE AT TIME ZONE 'Europe/Berlin')::date as europe_date
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY updated_at DESC;

-- 8. Verificar configuración de RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'model_values';

-- 9. Verificar índices en la tabla
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'model_values';

-- 10. Verificar si hay locks en la tabla
SELECT 
  pid,
  mode,
  locktype,
  relation::regclass,
  granted
FROM pg_locks 
WHERE relation = 'model_values'::regclass;
