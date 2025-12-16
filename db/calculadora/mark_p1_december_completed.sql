-- 🔧 MARCAR PERÍODO P1 DICIEMBRE COMO COMPLETADO
-- Esto desbloqueará las plataformas inmediatamente

-- 1. Ver estado actual
SELECT period_date, period_type, status, created_at, completed_at
FROM calculator_period_closure_status
WHERE period_date = '2025-12-15' OR period_date = '2025-12-01'
ORDER BY created_at DESC;

-- 2. Marcar como completado (actualizar el registro existente)
UPDATE calculator_period_closure_status
SET 
  status = 'completed',
  completed_at = NOW(),
  updated_at = NOW()
WHERE period_date = '2025-12-15' 
  AND period_type = '1-15'
  AND status != 'completed';

-- 3. Si no existe registro, crear uno nuevo
INSERT INTO calculator_period_closure_status (period_date, period_type, status, completed_at)
SELECT '2025-12-01', '1-15', 'completed', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM calculator_period_closure_status 
  WHERE period_date = '2025-12-01' AND period_type = '1-15'
);

-- 4. Verificar que se actualizó correctamente
SELECT period_date, period_type, status, completed_at
FROM calculator_period_closure_status
WHERE period_date IN ('2025-12-01', '2025-12-15')
ORDER BY created_at DESC;

