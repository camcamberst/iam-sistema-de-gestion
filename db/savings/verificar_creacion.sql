-- =====================================================
-- ✅ VERIFICAR CREACIÓN DE TABLAS DE AHORROS
-- =====================================================
-- Ejecuta este script después de crear las tablas
-- =====================================================

-- Verificar que todas las tablas existen
SELECT 
  table_name,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = t.table_name
    ) THEN '✅ Existe'
    ELSE '❌ No existe'
  END as estado
FROM (
  VALUES 
    ('model_savings'),
    ('savings_withdrawals'),
    ('savings_adjustments'),
    ('savings_goals')
) AS t(table_name);

-- Verificar estructura de model_savings
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'model_savings'
ORDER BY ordinal_position;

-- Verificar que RLS está habilitado
SELECT 
  tablename,
  rowsecurity as rls_habilitado
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('model_savings', 'savings_withdrawals', 'savings_adjustments', 'savings_goals');

-- Verificar políticas creadas
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename IN ('model_savings', 'savings_withdrawals', 'savings_adjustments', 'savings_goals')
ORDER BY tablename, policyname;
