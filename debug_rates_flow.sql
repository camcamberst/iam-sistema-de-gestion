-- =====================================================
-- 🔍 DEBUG FLUJO DE TASAS
-- =====================================================

-- 1. Verificar si existe la tabla rates
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rates' AND table_schema = 'public') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as rates_table_status;

-- 2. Verificar datos en rates
SELECT COUNT(*) as rates_count FROM rates;

-- 3. Ver tasas activas
SELECT 
  id,
  kind,
  value,
  scope,
  valid_from,
  valid_to,
  active
FROM rates 
WHERE valid_to IS NULL
ORDER BY valid_from DESC;

-- 4. Ver todas las tasas
SELECT 
  id,
  kind,
  value,
  scope,
  valid_from,
  valid_to,
  active
FROM rates 
ORDER BY valid_from DESC
LIMIT 10;
