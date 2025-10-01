-- 🔧 SOLUCIÓN PARA RECUPERAR VALORES DE LILLYSKY
-- ID: fe54995d-1828-4721-8153-53fce6f4fe56

-- 1. Verificar si hay valores con fechas de Bogotá que no se muestran
SELECT 
  'Valores con fecha Bogotá' as tipo,
  COUNT(*) as cantidad,
  STRING_AGG(DISTINCT period_date::text, ', ') as fechas
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date != (NOW() AT TIME ZONE 'Europe/Berlin')::date;

-- 2. Si hay valores con fechas anteriores, actualizar period_date
-- (Solo ejecutar si el paso 1 muestra valores)
UPDATE model_values 
SET period_date = (NOW() AT TIME ZONE 'Europe/Berlin')::date
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date != (NOW() AT TIME ZONE 'Europe/Berlin')::date;

-- 3. Verificar resultado después de la actualización
SELECT 
  'Después de actualización' as estado,
  COUNT(*) as total_valores,
  STRING_AGG(DISTINCT period_date::text, ', ') as fechas_actualizadas
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

-- 4. Verificar que la calculadora ahora muestre los valores
-- (Esto se verifica en la interfaz web)
