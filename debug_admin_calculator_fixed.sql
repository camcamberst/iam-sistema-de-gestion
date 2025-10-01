-- 🔍 DIAGNÓSTICO CORREGIDO: VERIFICAR CONFIGURACIÓN DE PLATAFORMAS PARA ADMIN
-- Problema: Admin no ve plataformas de la modelo

-- 1. Verificar estructura de la tabla calculator_config
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'calculator_config'
ORDER BY ordinal_position;

-- 2. Verificar configuración de calculadora para la modelo
SELECT 
  'calculator_config' as tabla,
  model_id,
  active,
  created_at,
  updated_at
FROM calculator_config 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'  -- ID de la modelo
ORDER BY created_at DESC;

-- 3. Verificar si hay configuración activa
SELECT 
  'config_status' as analisis,
  CASE 
    WHEN COUNT(*) > 0 THEN 'CONFIGURACIÓN EXISTE'
    ELSE 'NO HAY CONFIGURACIÓN'
  END as estado,
  COUNT(*) as total_configs
FROM calculator_config 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND active = true;

-- 4. Verificar permisos RLS para admin
SELECT 
  'rls_policies' as tipo,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'calculator_config';

-- 5. Verificar si hay datos en la tabla
SELECT 
  'data_check' as tipo,
  COUNT(*) as total_records,
  COUNT(DISTINCT model_id) as unique_models,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM calculator_config;
