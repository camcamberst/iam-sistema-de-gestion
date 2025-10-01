-- 🔍 DIAGNÓSTICO SISTÉMICO: PROBLEMA GENERAL DE "VER CALCULADORA DE MODELO"

-- 1. Verificar estructura de calculator_config
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'calculator_config'
ORDER BY ordinal_position;

-- 2. Verificar TODAS las configuraciones
SELECT 
  'all_configs' as tipo,
  model_id,
  active,
  created_at,
  updated_at
FROM calculator_config 
ORDER BY created_at DESC;

-- 3. Verificar configuraciones activas
SELECT 
  'active_configs' as tipo,
  COUNT(*) as total_active,
  STRING_AGG(DISTINCT model_id::text, ', ') as active_model_ids
FROM calculator_config 
WHERE active = true;

-- 4. Verificar permisos RLS
SELECT 
  'rls_status' as tipo,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'calculator_config';

-- 5. Verificar si hay datos en model_values (para confirmar que las modelos tienen datos)
SELECT 
  'model_values_check' as tipo,
  COUNT(*) as total_values,
  COUNT(DISTINCT model_id) as unique_models,
  MIN(period_date) as min_date,
  MAX(period_date) as max_date
FROM model_values;
