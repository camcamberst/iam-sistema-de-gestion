-- =====================================================
-- 🔍 VERIFICAR Y MIGRAR DATOS ANTIGUOS DEL SISTEMA V1
-- =====================================================

-- 1. Verificar si hay datos antiguos con columna 'platform' (sistema V1)
SELECT 
  COUNT(*) as old_records_count,
  'Datos del sistema V1 encontrados' as status
FROM information_schema.columns 
WHERE table_name = 'model_values' 
AND column_name = 'platform'
AND table_schema = 'public';

-- 2. Si existe la columna 'platform', verificar datos antiguos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'model_values' 
    AND column_name = 'platform'
    AND table_schema = 'public'
  ) THEN
    -- Mostrar datos antiguos
    RAISE NOTICE 'Columna platform existe - verificando datos antiguos...';
  ELSE
    RAISE NOTICE 'Columna platform NO existe - migración V2 completada';
  END IF;
END $$;

-- 3. Verificar si hay datos para el modelo específico en el sistema V2
SELECT 
  COUNT(*) as v2_records_count,
  model_id,
  'Datos del sistema V2' as system_version
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
GROUP BY model_id;

-- 4. Verificar si hay datos antiguos en otra tabla o formato
SELECT 
  'model_values' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT model_id) as unique_models,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM model_values;
