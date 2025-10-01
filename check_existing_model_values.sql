-- =====================================================
-- 🔍 VERIFICAR DATOS EXISTENTES EN MODEL_VALUES
-- =====================================================

-- 1. Verificar si hay datos en la tabla model_values
SELECT COUNT(*) as total_records FROM model_values;

-- 2. Verificar estructura de la tabla model_values
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'model_values' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Verificar datos existentes (últimos 10 registros)
SELECT 
  id,
  model_id,
  platform,
  platform_id,
  value,
  period_date,
  active,
  created_at,
  updated_at
FROM model_values 
ORDER BY updated_at DESC 
LIMIT 10;

-- 4. Verificar si hay datos para el modelo específico
SELECT 
  COUNT(*) as records_for_model,
  model_id,
  COUNT(DISTINCT platform) as unique_platforms_old,
  COUNT(DISTINCT platform_id) as unique_platforms_new
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
GROUP BY model_id;

-- 5. Verificar datos por período (últimos 7 días)
SELECT 
  period_date,
  COUNT(*) as records_count,
  SUM(value) as total_value
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
GROUP BY period_date
ORDER BY period_date DESC;
