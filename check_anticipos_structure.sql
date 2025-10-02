-- =====================================================
-- 🔍 VERIFICAR ESTRUCTURA DE TABLA ANTICIPOS
-- =====================================================

-- 1. Verificar estructura de la tabla anticipos
SELECT 'ESTRUCTURA TABLA ANTICIPOS:' as info;
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'anticipos' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar si existen índices
SELECT 'ÍNDICES EN ANTICIPOS:' as info;
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'anticipos';

-- 3. Verificar políticas RLS
SELECT 'POLÍTICAS RLS:' as info;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'anticipos';

-- 4. Verificar si RLS está habilitado
SELECT 'RLS HABILITADO:' as info;
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'anticipos';
