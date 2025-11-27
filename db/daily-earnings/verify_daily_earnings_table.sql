-- =====================================================
-- VERIFICAR TABLA daily_earnings - SISTEMA DE GESTIÓN AIM
-- =====================================================
-- Ejecutar este script para verificar que la tabla se creó correctamente

-- 1. Verificar que la tabla existe
SELECT 
  'VERIFICACIÓN DE TABLA' AS tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'daily_earnings'
    ) THEN '✅ Tabla daily_earnings existe'
    ELSE '❌ Tabla daily_earnings NO existe'
  END AS estado;

-- 2. Verificar estructura de la tabla
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'daily_earnings'
ORDER BY ordinal_position;

-- 3. Verificar índices
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'daily_earnings'
  AND schemaname = 'public';

-- 4. Verificar políticas RLS
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'daily_earnings';

-- 5. Verificar trigger
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'daily_earnings';

-- 6. Contar registros (debería ser 0 si es nueva)
SELECT 
  'REGISTROS EN TABLA' AS tipo,
  COUNT(*) AS total_registros
FROM daily_earnings;

