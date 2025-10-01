-- 🔍 VERIFICAR VALORES DE LILLYSKY DESPUÉS DEL CAMBIO DE HUSO HORARIO
-- ID: fe54995d-1828-4721-8153-53fce6f4fe56

-- 1. Verificar valores actuales en model_values
SELECT 
  'model_values' as tabla,
  model_id,
  platform_id,
  value,
  period_date,
  updated_at
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
ORDER BY updated_at DESC;

-- 2. Verificar si hay valores archivados en calculator_history
SELECT 
  'calculator_history' as tabla,
  model_id,
  platform_id,
  value,
  period_date,
  period_type,
  archived_at
FROM calculator_history 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
ORDER BY archived_at DESC;

-- 3. Verificar fechas de períodos (comparar husos horarios)
SELECT 
  'America/Bogota' as timezone,
  NOW() AT TIME ZONE 'America/Bogota' as current_date_bogota,
  (NOW() AT TIME ZONE 'America/Bogota')::date as period_date_bogota
UNION ALL
SELECT 
  'Europe/Berlin' as timezone,
  NOW() AT TIME ZONE 'Europe/Berlin' as current_date_berlin,
  (NOW() AT TIME ZONE 'Europe/Berlin')::date as period_date_berlin;

-- 4. Verificar si hay valores con fechas de Bogotá vs Berlín
SELECT 
  'model_values' as table_name,
  COUNT(*) as total_records,
  MIN(period_date) as min_date,
  MAX(period_date) as max_date,
  STRING_AGG(DISTINCT period_date::text, ', ') as all_dates
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
UNION ALL
SELECT 
  'calculator_history' as table_name,
  COUNT(*) as total_records,
  MIN(period_date) as min_date,
  MAX(period_date) as max_date,
  STRING_AGG(DISTINCT period_date::text, ', ') as all_dates
FROM calculator_history 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

-- 5. Verificar configuración de calculadora
SELECT 
  'calculator_config' as tabla,
  model_id,
  active,
  created_at,
  updated_at
FROM calculator_config 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

-- 6. Verificar diferencias de fecha específicas
SELECT 
  'Diferencia de fechas' as analisis,
  (NOW() AT TIME ZONE 'Europe/Berlin')::date as fecha_berlin,
  (NOW() AT TIME ZONE 'America/Bogota')::date as fecha_bogota,
  (NOW() AT TIME ZONE 'Europe/Berlin')::date - (NOW() AT TIME ZONE 'America/Bogota')::date as diferencia_dias;
