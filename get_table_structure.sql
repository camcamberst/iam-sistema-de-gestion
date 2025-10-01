-- 🔍 OBTENER ESTRUCTURA COMPLETA DE calculator_config

-- 1. Verificar estructura de la tabla
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'calculator_config'
ORDER BY ordinal_position;

-- 2. Verificar datos reales en la tabla
SELECT 
  'sample_data' as tipo,
  *
FROM calculator_config 
LIMIT 1;

-- 3. Verificar si la modelo específica tiene configuración
SELECT 
  'model_config' as tipo,
  *
FROM calculator_config 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

-- 4. Verificar todas las configuraciones activas
SELECT 
  'all_active_configs' as tipo,
  model_id,
  active,
  created_at
FROM calculator_config 
WHERE active = true
ORDER BY created_at DESC;
