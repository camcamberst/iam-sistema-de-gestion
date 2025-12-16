-- 🔍 BÚSQUEDA COMPLETA: Valores del P1 de Diciembre (1-15 de diciembre 2025)
-- También busca en 2024 por si hubo error de año (como ocurrió en el pasado)
-- Ejecutar este script directamente en Supabase SQL Editor

-- ============================================================
-- 0. BUSCAR EN 2024 (POR SI HUBO ERROR DE AÑO)
-- ============================================================

-- 0.1 Buscar P1 de diciembre 2024
SELECT 
  'calculator_history: 2024-12-01 a 2024-12-15 (P1)' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT platform_id) as plataformas_unicas
FROM calculator_history
WHERE period_date >= '2024-12-01' 
  AND period_date <= '2024-12-15'
  AND period_type = '1-15';

-- 0.2 Muestra de registros de diciembre 2024
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
WHERE period_date >= '2024-12-01' 
  AND period_date <= '2024-12-15'
  AND period_type = '1-15'
ORDER BY archived_at DESC
LIMIT 50;

-- 0.3 Buscar en calculator_totals de diciembre 2024
SELECT 
  'calculator_totals: 2024-12-01 a 2024-12-15' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  SUM(total_usd_bruto) as total_usd_bruto_sum,
  SUM(total_usd_modelo) as total_usd_modelo_sum,
  SUM(total_cop_modelo) as total_cop_modelo_sum
FROM calculator_totals
WHERE period_date >= '2024-12-01' 
  AND period_date <= '2024-12-15';

-- 0.4 Muestra de totales de diciembre 2024
SELECT 
  id,
  model_id,
  period_date,
  total_usd_bruto,
  total_usd_modelo,
  total_cop_modelo,
  updated_at
FROM calculator_totals
WHERE period_date >= '2024-12-01' 
  AND period_date <= '2024-12-15'
ORDER BY updated_at DESC
LIMIT 50;

-- ============================================================
-- 1. BUSCAR EN CALCULATOR_HISTORY (2025)
-- ============================================================

-- 1.1 Por period_date = 2025-12-01
SELECT 
  'calculator_history: period_date = 2025-12-01' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT platform_id) as plataformas_unicas
FROM calculator_history
WHERE period_date = '2025-12-01' 
  AND period_type = '1-15';

-- 1.2 Por period_date = 2025-12-15
SELECT 
  'calculator_history: period_date = 2025-12-15' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT platform_id) as plataformas_unicas
FROM calculator_history
WHERE period_date = '2025-12-15' 
  AND period_type = '1-15';

-- 1.3 En rango 2025-12-01 a 2025-12-15
SELECT 
  'calculator_history: rango 01-15' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT platform_id) as plataformas_unicas
FROM calculator_history
WHERE period_date >= '2025-12-01' 
  AND period_date <= '2025-12-15'
  AND period_type = '1-15';

-- 1.4 Con period_date = 2025-12-16 pero period_type = '1-15' (error de normalización)
SELECT 
  'calculator_history: 2025-12-16 con type 1-15' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas
FROM calculator_history
WHERE period_date = '2025-12-16' 
  AND period_type = '1-15';

-- 1.5 Archivos recientes (últimas 48 horas)
SELECT 
  'calculator_history: últimos 48h' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  MIN(archived_at) as fecha_archivo_mas_antigua,
  MAX(archived_at) as fecha_archivo_mas_reciente
FROM calculator_history
WHERE archived_at >= NOW() - INTERVAL '48 hours';

-- 1.6 MUESTRA DE REGISTROS (si hay)
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

-- ============================================================
-- 2. BUSCAR EN CALCULATOR_TOTALS
-- ============================================================

-- 2.1 Totales del 1-15 de diciembre
SELECT 
  'calculator_totals: 01-15 dic' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  SUM(total_usd_bruto) as total_usd_bruto_sum,
  SUM(total_usd_modelo) as total_usd_modelo_sum,
  SUM(total_cop_modelo) as total_cop_modelo_sum
FROM calculator_totals
WHERE period_date >= '2025-12-01' 
  AND period_date <= '2025-12-15';

-- 2.2 Totales del día 16 (normalizado)
SELECT 
  'calculator_totals: 16 dic' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  SUM(total_usd_bruto) as total_usd_bruto_sum,
  SUM(total_usd_modelo) as total_usd_modelo_sum,
  SUM(total_cop_modelo) as total_cop_modelo_sum
FROM calculator_totals
WHERE period_date = '2025-12-16';

-- 2.3 MUESTRA DE TOTALES
SELECT 
  id,
  model_id,
  period_date,
  total_usd_bruto,
  total_usd_modelo,
  total_cop_modelo,
  updated_at
FROM calculator_totals
WHERE period_date >= '2025-12-01' 
  AND period_date <= '2025-12-16'
ORDER BY updated_at DESC
LIMIT 50;

-- ============================================================
-- 3. BUSCAR EN CALC_SNAPSHOTS (si existe)
-- ============================================================

-- 3.1 Verificar si existe la tabla
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'calc_snapshots'
) as tabla_calc_snapshots_existe;

-- 3.2 Buscar snapshots recientes (solo si la tabla existe)
-- Si la tabla no existe, esta consulta fallará silenciosamente
-- Puedes comentarla si prefieres evitar el error
-- 
-- DESCOMENTA las siguientes líneas SOLO si la tabla calc_snapshots existe:
/*
SELECT 
  'calc_snapshots: últimos 48h' as busqueda,
  COUNT(*) as total_snapshots,
  COUNT(DISTINCT model_id) as modelos_unicas
FROM calc_snapshots
WHERE created_at >= NOW() - INTERVAL '48 hours';

SELECT 
  id,
  model_id,
  period_id,
  totals_json,
  rates_applied_json,
  created_at
FROM calc_snapshots
WHERE created_at >= '2025-12-01'
ORDER BY created_at DESC
LIMIT 20;
*/

-- ============================================================
-- 4. BUSCAR EN AUDIT_LOGS (si existe)
-- ============================================================

-- 4.1 Verificar si existe la tabla
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'audit_logs'
) as tabla_audit_logs_existe;

-- NOTA: Si la tabla audit_logs existe, descomenta las siguientes líneas:
/*
SELECT 
  'audit_logs: 01-16 dic' as busqueda,
  COUNT(*) as total_logs,
  COUNT(DISTINCT model_id) as modelos_unicas
FROM audit_logs
WHERE created_at >= '2025-12-01'
  AND created_at <= '2025-12-16';
*/

-- ============================================================
-- 5. DISTRIBUCIÓN COMPLETA DE CALCULATOR_HISTORY
-- ============================================================

SELECT 
  period_date,
  period_type,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  MIN(archived_at) as primer_archivo,
  MAX(archived_at) as ultimo_archivo
FROM calculator_history
GROUP BY period_date, period_type
ORDER BY period_date DESC, period_type
LIMIT 20;

-- ============================================================
-- 6. VERIFICAR MODEL_VALUES (aunque debería estar vacío)
-- ============================================================

-- 6.1 Contar registros restantes
SELECT 
  'model_values: restantes' as busqueda,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT platform_id) as plataformas_unicas
FROM model_values;

-- 6.2 Si hay registros, mostrar distribución por period_date
SELECT 
  period_date,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas,
  COUNT(DISTINCT platform_id) as plataformas_unicas
FROM model_values
GROUP BY period_date
ORDER BY period_date DESC
LIMIT 10;

-- ============================================================
-- 7. BUSCAR EN CALCULATOR_PERIOD_CLOSURE_STATUS (logs del cierre)
-- ============================================================

-- 7.1 Verificar estado del cierre del P1 de diciembre
SELECT 
  'period_closure_status: P1 dic' as busqueda,
  period_date,
  period_type,
  status,
  metadata,
  created_at,
  updated_at
FROM calculator_period_closure_status
WHERE period_date >= '2025-12-01'
  AND period_date <= '2025-12-15'
  AND period_type = '1-15'
ORDER BY created_at DESC
LIMIT 10;

-- 7.2 Verificar estado del cierre del día 16
SELECT 
  'period_closure_status: 16 dic' as busqueda,
  period_date,
  period_type,
  status,
  metadata,
  created_at,
  updated_at
FROM calculator_period_closure_status
WHERE period_date = '2025-12-16'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================
-- 8. RESUMEN FINAL
-- ============================================================

-- 8.1 Total de registros en calculator_history por mes
SELECT 
  DATE_TRUNC('month', period_date) as mes,
  period_type,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos_unicas
FROM calculator_history
WHERE period_date >= '2025-10-01'
GROUP BY DATE_TRUNC('month', period_date), period_type
ORDER BY mes DESC, period_type;

-- 8.2 Últimos 10 períodos archivados
SELECT 
  period_date,
  period_type,
  COUNT(*) as registros,
  COUNT(DISTINCT model_id) as modelos,
  MAX(archived_at) as ultimo_archivo
FROM calculator_history
GROUP BY period_date, period_type
ORDER BY period_date DESC, period_type
LIMIT 10;

