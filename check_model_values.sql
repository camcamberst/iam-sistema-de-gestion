-- Verificar datos en model_values para el usuario específico
-- User ID: fe54995d-1828-4721-8153-53fce6f4fe56

-- 1. Verificar si hay datos para este usuario
SELECT 
  model_id, 
  platform_id, 
  value, 
  period_date, 
  updated_at
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
ORDER BY period_date DESC, platform_id;

-- 2. Verificar estructura de la tabla
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'model_values'
ORDER BY ordinal_position;

-- 3. Contar registros totales
SELECT COUNT(*) as total_records FROM model_values;

-- 4. Verificar si hay datos para la fecha actual (2025-10-01)
SELECT 
  model_id, 
  platform_id, 
  value, 
  period_date
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date = '2025-10-01'
ORDER BY platform_id;
