-- =====================================================
-- ✅ VERIFICACIÓN: ESTUDIOS AFILIADOS
-- =====================================================
-- Ejecutar este SQL para verificar que todo se creó correctamente
-- =====================================================

-- 1. Verificar tabla affiliate_studios
SELECT 
  'affiliate_studios' as tabla,
  COUNT(*) as registros,
  '✅ Tabla creada' as estado
FROM affiliate_studios;

-- 2. Verificar columnas agregadas a users
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'affiliate_studio_id';

-- 3. Verificar columnas agregadas a groups (si existe)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'groups' 
  AND column_name = 'affiliate_studio_id';

-- 4. Verificar índices creados
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_%affiliate%'
ORDER BY tablename, indexname;

-- 5. Verificar tabla affiliate_billing_summary
SELECT 
  'affiliate_billing_summary' as tabla,
  COUNT(*) as registros,
  '✅ Tabla creada' as estado
FROM affiliate_billing_summary;

-- 6. Verificar políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('affiliate_studios', 'affiliate_billing_summary')
ORDER BY tablename, policyname;

-- 7. Resumen de tablas modificadas
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE column_name = 'affiliate_studio_id'
  AND table_schema = 'public'
ORDER BY table_name;

