-- 🔍 DEBUG: Verificar persistencia de valores en base de datos
-- 
-- Este script verifica:
-- 1. Si los valores se están guardando en la tabla correcta
-- 2. Si las fechas son consistentes
-- 3. Si hay valores duplicados o conflictivos
-- 4. Si el upsert está funcionando correctamente

-- 1. Verificar estructura de tabla model_values
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'model_values' 
ORDER BY ordinal_position;

-- 2. Verificar todos los valores para un modelo específico
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at,
  created_at
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
ORDER BY period_date DESC, platform_id;

-- 3. Verificar valores por fecha específica (hoy Europa Central)
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date = CURRENT_DATE AT TIME ZONE 'Europe/Berlin'::text
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

-- 5. Verificar valores más recientes
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND updated_at >= NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;

-- 6. Verificar fechas de períodos disponibles
SELECT DISTINCT 
  period_date,
  COUNT(*) as values_count
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
  EXTRACT(TIMEZONE FROM updated_at) as timezone_offset
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY updated_at DESC;
