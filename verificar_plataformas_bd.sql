-- =====================================================
-- 🔍 VERIFICAR PLATAFORMAS EN BASE DE DATOS
-- =====================================================

-- 1. Verificar si existe la tabla calculator_platforms
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_platforms') 
    THEN '✅ Tabla calculator_platforms EXISTE'
    ELSE '❌ Tabla calculator_platforms NO EXISTE'
  END as tabla_calculator_platforms;

-- 2. Verificar si existe la tabla platforms (alternativa)
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platforms') 
    THEN '✅ Tabla platforms EXISTE'
    ELSE '❌ Tabla platforms NO EXISTE'
  END as tabla_platforms;

-- 3. Contar registros en calculator_platforms
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_platforms') 
    THEN (SELECT COUNT(*) FROM calculator_platforms)::text
    ELSE 'Tabla no existe'
  END as total_calculator_platforms;

-- 4. Contar registros en platforms (solo si existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platforms') THEN
    PERFORM (SELECT COUNT(*) FROM platforms);
  END IF;
END $$;

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platforms') 
    THEN (SELECT COUNT(*)::text FROM platforms)
    ELSE 'Tabla platforms no existe'
  END as total_platforms;

-- 5. Ver estructura de calculator_platforms (si existe)
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'calculator_platforms'
ORDER BY ordinal_position;

-- 6. Ver estructura de platforms (si existe)
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'platforms'
ORDER BY ordinal_position;

-- 7. Ver datos en calculator_platforms (si existe y tiene datos)
SELECT 
  id, 
  name, 
  currency, 
  active,
  created_at
FROM calculator_platforms 
ORDER BY name
LIMIT 10;

-- 8. Ver datos en platforms (si existe y tiene datos)
SELECT 
  id, 
  name, 
  code,
  conversion_type,
  active
FROM platforms 
ORDER BY name
LIMIT 10;

-- 9. Verificar permisos RLS en calculator_platforms
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'calculator_platforms';

-- 10. Verificar permisos RLS en platforms
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'platforms';

-- 11. Buscar cualquier tabla que contenga "platform" en el nombre
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name ILIKE '%platform%'
ORDER BY table_name;

-- 12. Verificar si hay datos en otras tablas relacionadas
SELECT 
  'users' as tabla,
  COUNT(*) as total_registros
FROM users
UNION ALL
SELECT 
  'calculator_config' as tabla,
  COUNT(*) as total_registros
FROM calculator_config
UNION ALL
SELECT 
  'model_values' as tabla,
  COUNT(*) as total_registros
FROM model_values;
