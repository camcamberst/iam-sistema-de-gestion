-- 🔧 CORREGIR ESTADO DEL PERÍODO P1 DICIEMBRE
-- Actualizar el registro existente con period_date = '2025-12-15'

-- 1. Ver qué registros existen
SELECT id, period_date, period_type, status, created_at, completed_at
FROM calculator_period_closure_status
WHERE period_date IN ('2025-12-01', '2025-12-15')
ORDER BY created_at DESC;

-- 2. Actualizar el registro que tiene period_date = '2025-12-15'
UPDATE calculator_period_closure_status
SET 
  status = 'completed',
  completed_at = COALESCE(completed_at, NOW()),
  updated_at = NOW()
WHERE period_date = '2025-12-15' 
  AND period_type = '1-15';

-- 3. Si el registro tiene period_date = '2025-12-01', actualizarlo también
UPDATE calculator_period_closure_status
SET 
  status = 'completed',
  completed_at = COALESCE(completed_at, NOW()),
  updated_at = NOW()
WHERE period_date = '2025-12-01' 
  AND period_type = '1-15';

-- 4. Verificar que se actualizó
SELECT id, period_date, period_type, status, completed_at, updated_at
FROM calculator_period_closure_status
WHERE period_date IN ('2025-12-01', '2025-12-15')
ORDER BY created_at DESC;

