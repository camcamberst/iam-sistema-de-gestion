-- 🔍 VERIFICAR ESTRUCTURA COMPLETA DEL SISTEMA DE CALCULADORA

-- 1. Verificar todas las tablas relacionadas con calculadora
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name LIKE '%calculator%' 
   OR table_name LIKE '%model%'
ORDER BY table_name;

-- 2. Verificar estructura de calculator_config
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'calculator_config'
ORDER BY ordinal_position;

-- 3. Verificar si hay datos en calculator_config
SELECT 
  'calculator_config_data' as tipo,
  COUNT(*) as total_records,
  COUNT(DISTINCT model_id) as unique_models,
  STRING_AGG(DISTINCT model_id::text, ', ') as model_ids
FROM calculator_config;

-- 4. Verificar si la modelo específica tiene configuración
SELECT 
  'model_specific_config' as tipo,
  model_id,
  active,
  created_at,
  updated_at
FROM calculator_config 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

-- 5. Verificar si hay configuración activa para cualquier modelo
SELECT 
  'active_configs' as tipo,
  COUNT(*) as total_active,
  STRING_AGG(DISTINCT model_id::text, ', ') as active_model_ids
FROM calculator_config 
WHERE active = true;
