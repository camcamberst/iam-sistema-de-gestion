-- 🔧 SOLUCIÓN INMEDIATA: CORREGIR DIFERENCIA DE FECHAS
-- ID: fe54995d-1828-4721-8153-53fce6f4fe56

-- 1. Verificar valores con fecha de Colombia (2025-10-01)
SELECT 
  'Valores con fecha Colombia' as tipo,
  COUNT(*) as cantidad,
  STRING_AGG(DISTINCT platform_id, ', ') as plataformas,
  STRING_AGG(DISTINCT value::text, ', ') as valores
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date = '2025-10-01';

-- 2. Actualizar period_date de Colombia a Europa Central
UPDATE model_values 
SET period_date = '2025-10-02'  -- Fecha de Europa Central
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date = '2025-10-01';  -- Fecha de Colombia

-- 3. Verificar resultado
SELECT 
  'Después de corrección' as estado,
  COUNT(*) as total_valores,
  STRING_AGG(DISTINCT platform_id, ', ') as plataformas,
  STRING_AGG(DISTINCT value::text, ', ') as valores
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date = '2025-10-02';
