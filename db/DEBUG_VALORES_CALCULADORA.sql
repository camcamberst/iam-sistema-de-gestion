-- 🔍 DEBUG: Verificar qué valores hay en model_values
-- Ejecuta esto para ver qué valores tiene el sistema actualmente

-- 1. Ver TODOS los valores de enero 2026 (P1 y P2)
SELECT 
  model_id,
  platform_id,
  value,
  period_date,
  updated_at,
  CASE 
    WHEN period_date::text LIKE '%-01' THEN 'P1 (día 1)'
    WHEN period_date::text LIKE '%-16' THEN 'P2 (día 16)'
    ELSE 'Otro día'
  END as periodo_tipo
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31'
ORDER BY model_id, platform_id, period_date DESC;

-- 2. Ver cuántos valores hay por periodo
SELECT 
  period_date,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_distintas,
  SUM(value) as suma_valores
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31'
GROUP BY period_date
ORDER BY period_date;

-- 3. Ver valores duplicados (misma modelo + plataforma en múltiples fechas)
SELECT 
  model_id,
  platform_id,
  COUNT(*) as cantidad_fechas,
  STRING_AGG(period_date::text || ' (' || value || ')', ', ' ORDER BY period_date) as fechas_y_valores
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31'
GROUP BY model_id, platform_id
HAVING COUNT(*) > 1
ORDER BY cantidad_fechas DESC
LIMIT 20;
