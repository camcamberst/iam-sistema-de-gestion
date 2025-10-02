-- 🔍 VERIFICAR ESTRUCTURA ACTUAL DE SUPABASE
-- 
-- Este script verifica la estructura real de las tablas en Supabase
-- para entender cómo debería funcionar "Mi Calculadora"

-- 1. VERIFICAR ESTRUCTURA DE TABLA model_values
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'model_values' 
ORDER BY ordinal_position;

-- 2. VERIFICAR ÍNDICES EN model_values
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'model_values';

-- 3. VERIFICAR CONSTRAINTS EN model_values
SELECT 
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints 
WHERE table_name = 'model_values';

-- 4. VERIFICAR ESTRUCTURA DE TABLA calculator_config
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'calculator_config' 
ORDER BY ordinal_position;

-- 5. VERIFICAR ESTRUCTURA DE TABLA calculator_platforms
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'calculator_platforms' 
ORDER BY ordinal_position;

-- 6. VERIFICAR ESTRUCTURA DE TABLA calculator_history
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'calculator_history' 
ORDER BY ordinal_position;

-- 7. VERIFICAR RLS (ROW LEVEL SECURITY) EN model_values
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

-- 8. VERIFICAR DATOS DE EJEMPLO EN model_values
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  created_at,
  updated_at
FROM model_values 
ORDER BY updated_at DESC 
LIMIT 10;

-- 9. VERIFICAR DATOS DE EJEMPLO EN calculator_config
SELECT 
  model_id,
  admin_id,
  enabled_platforms,
  percentage_override,
  group_percentage,
  active,
  created_at,
  updated_at
FROM calculator_config 
ORDER BY updated_at DESC 
LIMIT 5;

-- 10. VERIFICAR DATOS DE EJEMPLO EN calculator_platforms
SELECT 
  id,
  name,
  currency,
  token_rate,
  discount_factor,
  active
FROM calculator_platforms 
ORDER BY name 
LIMIT 10;

-- 11. VERIFICAR ESTADÍSTICAS DE TABLAS
SELECT 
  schemaname,
  relname as tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples
FROM pg_stat_user_tables 
WHERE relname IN ('model_values', 'calculator_config', 'calculator_platforms', 'calculator_history')
ORDER BY relname;

-- 12. VERIFICAR ÚLTIMAS ACTIVIDADES
SELECT 
  'model_values' as table_name,
  COUNT(*) as total_records,
  MAX(updated_at) as last_update
FROM model_values

UNION ALL

SELECT 
  'calculator_config' as table_name,
  COUNT(*) as total_records,
  MAX(updated_at) as last_update
FROM calculator_config

UNION ALL

SELECT 
  'calculator_platforms' as table_name,
  COUNT(*) as total_records,
  MAX(updated_at) as last_update
FROM calculator_platforms

UNION ALL

SELECT 
  'calculator_history' as table_name,
  COUNT(*) as total_records,
  MAX(updated_at) as last_update
FROM calculator_history;
