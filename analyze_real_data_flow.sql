-- 🔍 ANÁLISIS REAL: Flujo de datos entre Mi Calculadora y Supabase
-- 
-- Este script analiza el flujo real de datos para identificar:
-- 1. Si los valores se están guardando correctamente
-- 2. Si hay problemas de fechas o timezone
-- 3. Si hay conflictos entre guardado y carga
-- 4. Si el upsert está funcionando correctamente

-- 1. VERIFICAR ESTRUCTURA DE TABLA model_values
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'model_values' 
ORDER BY ordinal_position;

-- 2. VERIFICAR TODOS LOS VALORES PARA UN MODELO ESPECÍFICO
-- (Reemplaza 'MODEL_ID_AQUI' con el ID real del modelo que está probando)
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

-- 3. VERIFICAR VALORES POR FECHA ESPECÍFICA (HOY EUROPA CENTRAL)
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at,
  EXTRACT(TIMEZONE FROM updated_at) as timezone_offset
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date = (CURRENT_DATE AT TIME ZONE 'Europe/Berlin')::date
ORDER BY platform_id;

-- 4. VERIFICAR SI HAY VALORES DUPLICADOS (CONFLICTO DE UPSERT)
SELECT 
  model_id,
  platform_id,
  period_date,
  COUNT(*) as count,
  STRING_AGG(value::text, ', ') as values,
  STRING_AGG(updated_at::text, ', ') as timestamps
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
GROUP BY model_id, platform_id, period_date
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 5. VERIFICAR VALORES MÁS RECIENTES (ÚLTIMAS 2 HORAS)
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at,
  NOW() - updated_at as time_ago
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND updated_at >= NOW() - INTERVAL '2 hours'
ORDER BY updated_at DESC;

-- 6. VERIFICAR FECHAS DE PERÍODOS DISPONIBLES
SELECT DISTINCT 
  period_date,
  COUNT(*) as values_count,
  MAX(updated_at) as last_updated,
  MIN(updated_at) as first_updated
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
GROUP BY period_date
ORDER BY period_date DESC;

-- 7. VERIFICAR CONFLICTOS DE TIMEZONE
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at,
  EXTRACT(TIMEZONE FROM updated_at) as timezone_offset,
  NOW() as server_time,
  (CURRENT_DATE AT TIME ZONE 'Europe/Berlin')::date as europe_date,
  (CURRENT_DATE AT TIME ZONE 'America/Bogota')::date as colombia_date
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY updated_at DESC;

-- 8. VERIFICAR CONFIGURACIÓN DE RLS (ROW LEVEL SECURITY)
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

-- 9. VERIFICAR ÍNDICES EN LA TABLA
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'model_values';

-- 10. VERIFICAR SI HAY LOCKS EN LA TABLA
SELECT 
  pid,
  mode,
  locktype,
  relation::regclass,
  granted
FROM pg_locks 
WHERE relation = 'model_values'::regclass;

-- 11. VERIFICAR ESTADÍSTICAS DE LA TABLA
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples
FROM pg_stat_user_tables 
WHERE tablename = 'model_values';

-- 12. VERIFICAR ÚLTIMAS ACTIVIDADES EN LA TABLA
SELECT 
  'INSERT' as operation,
  COUNT(*) as count
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND created_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'UPDATE' as operation,
  COUNT(*) as count
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND updated_at >= NOW() - INTERVAL '24 hours'
  AND updated_at != created_at;
