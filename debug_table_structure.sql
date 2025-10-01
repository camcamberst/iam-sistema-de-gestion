-- Verificar estructura de la tabla model_values
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'model_values' 
ORDER BY ordinal_position;

-- Verificar índices
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'model_values';

-- Verificar datos específicos
SELECT 
  model_id, 
  platform_id, 
  value, 
  period_date, 
  updated_at
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56' 
  AND period_date = '2025-10-01'
ORDER BY platform_id;
