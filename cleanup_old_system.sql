-- =====================================================
-- 🧹 LIMPIEZA COMPLETA DEL SISTEMA ANTIGUO
-- =====================================================
-- Eliminar completamente el sistema V1 para evitar conflictos futuros
-- =====================================================

-- 1. Verificar qué tablas y columnas del sistema antiguo existen
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public'
AND (
  table_name LIKE '%calculator%' 
  OR column_name LIKE '%platform%'
  OR column_name LIKE '%active%'
)
ORDER BY table_name, ordinal_position;

-- 2. Eliminar datos antiguos de model_values (solo mantener V2)
-- Primero verificar si hay datos con platform_id NULL (datos antiguos)
SELECT 
  COUNT(*) as records_with_null_platform_id,
  'Datos antiguos encontrados' as status
FROM model_values 
WHERE platform_id IS NULL;

-- 3. Eliminar registros antiguos (si existen)
DELETE FROM model_values 
WHERE platform_id IS NULL 
OR period_date IS NULL;

-- 4. Verificar si existe la tabla model_values_old o similar
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%model_values%'
ORDER BY table_name;

-- 5. Eliminar columnas obsoletas si existen
DO $$
BEGIN
  -- Eliminar columna 'platform' si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'model_values' 
    AND column_name = 'platform'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE model_values DROP COLUMN platform;
    RAISE NOTICE 'Columna platform eliminada';
  END IF;
  
  -- Eliminar columna 'active' si existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'model_values' 
    AND column_name = 'active'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE model_values DROP COLUMN active;
    RAISE NOTICE 'Columna active eliminada';
  END IF;
  
  -- Eliminar columna 'period_id' si existe (reemplazada por period_date)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'model_values' 
    AND column_name = 'period_id'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE model_values DROP COLUMN period_id;
    RAISE NOTICE 'Columna period_id eliminada';
  END IF;
END $$;

-- 6. Verificar estructura final de model_values
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'model_values' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Verificar que solo queden datos V2
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE platform_id IS NOT NULL) as v2_records,
  COUNT(*) FILTER (WHERE period_date IS NOT NULL) as records_with_period
FROM model_values;

-- 8. Limpiar índices obsoletos si existen
DROP INDEX IF EXISTS model_values_platform_idx;
DROP INDEX IF EXISTS model_values_active_idx;
DROP INDEX IF EXISTS model_values_period_id_idx;

-- 9. Verificar índices actuales
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'model_values' 
AND schemaname = 'public';

-- 10. Resumen final
SELECT 
  'LIMPIEZA COMPLETADA' as status,
  COUNT(*) as total_records_remaining,
  COUNT(DISTINCT model_id) as unique_models,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM model_values;
