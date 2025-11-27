-- =====================================================
-- REFRESCAR SCHEMA CACHE Y VERIFICAR TABLA daily_earnings
-- =====================================================
-- Este script ayuda a resolver problemas de cache de schema en Supabase

-- 1. Verificar que la tabla existe en el schema correcto
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables
WHERE tablename = 'daily_earnings';

-- 2. Si la tabla existe, forzar refresh del schema cache
-- Nota: En Supabase, esto generalmente se hace automáticamente,
-- pero podemos verificar que todo esté correcto

-- 3. Verificar que la tabla está en el schema 'public'
SELECT 
  'VERIFICACIÓN DE SCHEMA' AS tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'daily_earnings'
    ) THEN '✅ Tabla está en schema public'
    ELSE '❌ Tabla NO está en schema public'
  END AS estado;

-- 4. Verificar permisos de la tabla
SELECT 
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'daily_earnings';

-- 5. Si la tabla no existe, ejecutar el script de creación completo
-- (Esto es solo para verificación, no crea la tabla)

