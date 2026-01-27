-- =====================================================
-- 🔍 VERIFICAR SI LAS TABLAS DE AHORROS EXISTEN
-- =====================================================
-- Ejecuta este script primero para verificar el estado
-- =====================================================

-- Verificar existencia de tablas
SELECT 
  table_name,
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = table_name
    ) THEN '✅ Existe'
    ELSE '❌ No existe'
  END as estado
FROM (
  VALUES 
    ('model_savings'),
    ('savings_withdrawals'),
    ('savings_adjustments'),
    ('savings_goals')
) AS tables_to_check(table_name);

-- Verificar si model_savings existe específicamente
SELECT 
  'model_savings' as tabla,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'model_savings'
  ) as existe;

-- Si la consulta anterior devuelve 'false', necesitas ejecutar:
-- db/savings/create_savings_schema.sql
