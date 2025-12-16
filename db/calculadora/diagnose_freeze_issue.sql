-- 🔍 DIAGNÓSTICO COMPLETO: Por qué las plataformas siguen congeladas
-- Ejecutar estas consultas para entender el problema

-- 1. Verificar estado del período P1 diciembre (2025-12-15)
SELECT 
  period_date,
  period_type,
  status,
  created_at,
  completed_at
FROM calculator_period_closure_status
WHERE period_date = '2025-12-15' OR period_date = '2025-12-01'
ORDER BY created_at DESC
LIMIT 5;

-- 2. Verificar qué registros de early freeze quedan
SELECT 
  period_date,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_afectados,
  COUNT(DISTINCT platform_id) as plataformas_afectadas,
  MIN(frozen_at) as primer_congelamiento,
  MAX(frozen_at) as ultimo_congelamiento
FROM calculator_early_frozen_platforms
GROUP BY period_date
ORDER BY period_date DESC;

-- 3. Ver el período actual según la fecha de hoy
-- (Ejecutar esto para ver qué período debería estar activo)
SELECT 
  CURRENT_DATE as fecha_actual,
  CASE 
    WHEN EXTRACT(DAY FROM CURRENT_DATE) <= 15 THEN '1-15'
    ELSE '16-31'
  END as periodo_actual_tipo,
  CASE 
    WHEN EXTRACT(DAY FROM CURRENT_DATE) <= 15 
    THEN DATE_TRUNC('month', CURRENT_DATE)::date
    ELSE (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '15 days')::date
  END as periodo_actual_fecha;

-- 4. Verificar si hay registros de early freeze para el período actual
SELECT 
  efp.period_date,
  efp.platform_id,
  efp.model_id,
  efp.frozen_at,
  cps.status as closure_status
FROM calculator_early_frozen_platforms efp
LEFT JOIN calculator_period_closure_status cps 
  ON efp.period_date = cps.period_date 
  AND cps.period_type = CASE 
    WHEN EXTRACT(DAY FROM efp.period_date) <= 15 THEN '1-15'
    ELSE '16-31'
  END
WHERE efp.frozen_at >= NOW() - INTERVAL '7 days'
ORDER BY efp.frozen_at DESC
LIMIT 50;
