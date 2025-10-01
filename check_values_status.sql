-- 🔍 VERIFICAR ESTADO DE VALORES DESPUÉS DEL CAMBIO DE HUSO HORARIO

-- 1. Verificar valores actuales en model_values
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at
FROM model_values 
WHERE model_id = 'TU_MODEL_ID_AQUI'  -- Reemplazar con ID real
ORDER BY updated_at DESC;

-- 2. Verificar si hay valores archivados en calculator_history
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  period_type,
  archived_at
FROM calculator_history 
WHERE model_id = 'TU_MODEL_ID_AQUI'  -- Reemplazar con ID real
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
  MAX(period_date) as max_date
FROM model_values 
WHERE model_id = 'TU_MODEL_ID_AQUI'
UNION ALL
SELECT 
  'calculator_history' as table_name,
  COUNT(*) as total_records,
  MIN(period_date) as min_date,
  MAX(period_date) as max_date
FROM calculator_history 
WHERE model_id = 'TU_MODEL_ID_AQUI';
