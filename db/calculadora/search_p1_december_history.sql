-- 🔍 BÚSQUEDA EXHAUSTIVA: Valores del P1 de Diciembre (1-15)
-- Buscar en calculator_history con diferentes criterios de fecha

-- 1. Buscar por period_date = 2025-12-01 (inicio del período)
SELECT 
  'Por period_date = 2025-12-01' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT platform_id) as plataformas_unicas
FROM calculator_history
WHERE period_date = '2025-12-01' 
  AND period_type = '1-15';

-- 2. Buscar por period_date = 2025-12-15 (fin del período)
SELECT 
  'Por period_date = 2025-12-15' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT platform_id) as plataformas_unicas
FROM calculator_history
WHERE period_date = '2025-12-15' 
  AND period_type = '1-15';

-- 3. Buscar en rango 2025-12-01 a 2025-12-15
SELECT 
  'Por rango 2025-12-01 a 2025-12-15' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT platform_id) as plataformas_unicas
FROM calculator_history
WHERE period_date >= '2025-12-01' 
  AND period_date <= '2025-12-15'
  AND period_type = '1-15';

-- 4. Buscar TODOS los registros de diciembre 2025 (cualquier fecha)
SELECT 
  'Todos diciembre 2025' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT platform_id) as plataformas_unicas,
  array_agg(DISTINCT period_date ORDER BY period_date) as fechas_encontradas,
  array_agg(DISTINCT period_type ORDER BY period_type) as tipos_periodo
FROM calculator_history
WHERE period_date >= '2025-12-01' 
  AND period_date <= '2025-12-31';

-- 5. Buscar por archived_at reciente (últimas 24 horas)
SELECT 
  'Por archived_at reciente (últimas 24h)' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT platform_id) as plataformas_unicas,
  MIN(archived_at) as fecha_archivo_mas_antigua,
  MAX(archived_at) as fecha_archivo_mas_reciente
FROM calculator_history
WHERE archived_at >= NOW() - INTERVAL '24 hours';

-- 6. Mostrar muestra de registros encontrados (si hay)
SELECT 
  id,
  model_id,
  platform_id,
  value,
  period_date,
  period_type,
  archived_at,
  value_usd_bruto,
  value_usd_modelo,
  value_cop_modelo
FROM calculator_history
WHERE period_date >= '2025-12-01' 
  AND period_date <= '2025-12-15'
  AND period_type = '1-15'
ORDER BY archived_at DESC
LIMIT 50;

-- 7. Verificar si hay registros con period_date = 2025-12-16 pero period_type = '1-15' (error de normalización)
SELECT 
  'Por period_date = 2025-12-16 pero period_type = 1-15' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas
FROM calculator_history
WHERE period_date = '2025-12-16' 
  AND period_type = '1-15';

-- 8. Verificar TODAS las fechas y tipos de período en calculator_history
SELECT 
  period_date,
  period_type,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  MIN(archived_at) as primer_archivo,
  MAX(archived_at) as ultimo_archivo
FROM calculator_history
GROUP BY period_date, period_type
ORDER BY period_date DESC, period_type;

