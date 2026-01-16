-- =====================================================
-- 🔍 BÚSQUEDA MANUAL: P1 ENERO 2026
-- =====================================================
-- Ejecuta este SQL en Supabase Dashboard → SQL Editor
-- =====================================================

-- =====================================================
-- 1. CALCULATOR_HISTORY - TODAS LAS VARIACIONES
-- =====================================================

-- 1.1. Fecha correcta (2026-01-01)
SELECT 
    '1.1 CALCULATOR_HISTORY (2026-01-01)' as busqueda,
    COUNT(*) as total_registros,
    COUNT(DISTINCT model_id) as modelos_unicos,
    COUNT(DISTINCT platform_id) as plataformas_unicas,
    MIN(value) as valor_minimo,
    MAX(value) as valor_maximo,
    SUM(value) as suma_total
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15';

-- 1.2. Error de año (2025-01-01)
SELECT 
    '1.2 CALCULATOR_HISTORY (2025-01-01 - ERROR AÑO)' as busqueda,
    COUNT(*) as total_registros,
    COUNT(DISTINCT model_id) as modelos_unicos,
    COUNT(DISTINCT platform_id) as plataformas_unicas
FROM calculator_history
WHERE period_date = '2025-01-01'
  AND period_type = '1-15';

-- 1.3. Cualquier fecha de enero 2026
SELECT 
    '1.3 CALCULATOR_HISTORY (enero 2026)' as busqueda,
    period_date,
    period_type,
    COUNT(*) as registros,
    COUNT(DISTINCT model_id) as modelos
FROM calculator_history
WHERE period_date >= '2026-01-01'
  AND period_date <= '2026-01-31'
GROUP BY period_date, period_type
ORDER BY period_date;

-- 1.4. Por fecha de archivo (15-17 enero)
SELECT 
    '1.4 CALCULATOR_HISTORY (por archived_at)' as busqueda,
    period_date,
    period_type,
    COUNT(*) as registros,
    MIN(archived_at) as primer_archivo,
    MAX(archived_at) as ultimo_archivo
FROM calculator_history
WHERE archived_at >= '2026-01-15 00:00:00'
  AND archived_at <= '2026-01-17 23:59:59'
GROUP BY period_date, period_type
ORDER BY period_date;

-- 1.5. MUESTRA DE DATOS (si existen)
SELECT 
    '1.5 MUESTRA CALCULATOR_HISTORY' as info,
    model_id,
    platform_id,
    value,
    period_date,
    period_type,
    archived_at
FROM calculator_history
WHERE (period_date = '2026-01-01' AND period_type = '1-15')
   OR (period_date = '2025-01-01' AND period_type = '1-15')
   OR (archived_at >= '2026-01-15' AND archived_at <= '2026-01-17')
LIMIT 10;

-- =====================================================
-- 2. MODEL_VALUES - VERIFICAR SI NO SE BORRARON
-- =====================================================

-- 2.1. Rango del P1 (2026-01-01 a 2026-01-15)
SELECT 
    '2.1 MODEL_VALUES (2026-01-01 a 15)' as busqueda,
    COUNT(*) as total_registros,
    COUNT(DISTINCT model_id) as modelos_unicos,
    COUNT(DISTINCT platform_id) as plataformas_unicas,
    MIN(period_date) as fecha_minima,
    MAX(period_date) as fecha_maxima,
    SUM(value) as suma_total
FROM model_values
WHERE period_date >= '2026-01-01'
  AND period_date <= '2026-01-15';

-- 2.2. Error de año (2025-01-01 a 2025-01-15)
SELECT 
    '2.2 MODEL_VALUES (2025-01-01 a 15 - ERROR AÑO)' as busqueda,
    COUNT(*) as total_registros,
    COUNT(DISTINCT model_id) as modelos_unicos,
    MIN(period_date) as fecha_minima,
    MAX(period_date) as fecha_maxima
FROM model_values
WHERE period_date >= '2025-01-01'
  AND period_date <= '2025-01-15';

-- 2.3. Detalle por fecha
SELECT 
    '2.3 MODEL_VALUES (detalle por fecha)' as busqueda,
    period_date,
    COUNT(*) as registros,
    COUNT(DISTINCT model_id) as modelos,
    COUNT(DISTINCT platform_id) as plataformas,
    SUM(value) as suma
FROM model_values
WHERE period_date >= '2026-01-01'
  AND period_date <= '2026-01-31'
GROUP BY period_date
ORDER BY period_date;

-- 2.4. MUESTRA DE DATOS (si existen)
SELECT 
    '2.4 MUESTRA MODEL_VALUES' as info,
    model_id,
    platform_id,
    value,
    period_date,
    created_at,
    updated_at
FROM model_values
WHERE period_date >= '2026-01-01'
  AND period_date <= '2026-01-15'
ORDER BY created_at DESC
LIMIT 20;

-- =====================================================
-- 3. CALC_SNAPSHOTS - BUSCAR BACKUPS
-- =====================================================

-- 3.1. Por fecha de creación
SELECT 
    '3.1 CALC_SNAPSHOTS (15-17 enero)' as busqueda,
    COUNT(*) as total_snapshots,
    COUNT(DISTINCT model_id) as modelos_unicos,
    MIN(created_at) as primer_snapshot,
    MAX(created_at) as ultimo_snapshot
FROM calc_snapshots
WHERE created_at >= '2026-01-15 00:00:00'
  AND created_at <= '2026-01-17 23:59:59';

-- 3.2. Detalle de snapshots con datos en JSON
SELECT 
    '3.2 SNAPSHOTS CON DATOS' as info,
    id,
    model_id,
    period_id,
    created_at,
    totals_json->>'period_date' as period_date_en_json,
    totals_json->>'period_type' as period_type_en_json,
    jsonb_array_length(COALESCE(totals_json->'values', '[]'::jsonb)) as cantidad_valores
FROM calc_snapshots
WHERE created_at >= '2026-01-15'
  AND created_at <= '2026-01-17'
ORDER BY created_at DESC;

-- 3.3. Buscar en JSON por contenido
SELECT 
    '3.3 SNAPSHOTS (buscar 2026-01 en JSON)' as busqueda,
    COUNT(*) as encontrados
FROM calc_snapshots
WHERE totals_json::text LIKE '%2026-01%'
   OR rates_applied_json::text LIKE '%2026-01%';

-- =====================================================
-- 4. CALCULATOR_TOTALS - CONFIRMAR TOTALES
-- =====================================================

-- 4.1. Totales para 2026-01-01
SELECT 
    '4.1 CALCULATOR_TOTALS (2026-01-01)' as busqueda,
    COUNT(*) as total_registros,
    COUNT(DISTINCT model_id) as modelos_unicos,
    SUM(total_usd_bruto::numeric) as suma_usd_bruto,
    SUM(total_usd_modelo::numeric) as suma_usd_modelo,
    MIN(updated_at) as primera_actualizacion,
    MAX(updated_at) as ultima_actualizacion
FROM calculator_totals
WHERE period_date = '2026-01-01';

-- 4.2. Detalle de modelos con totales
SELECT 
    '4.2 DETALLE CALCULATOR_TOTALS' as info,
    ct.model_id,
    u.email as modelo_email,
    u.name as modelo_name,
    ct.total_usd_bruto,
    ct.total_usd_modelo,
    ct.total_cop_modelo,
    ct.updated_at
FROM calculator_totals ct
LEFT JOIN users u ON ct.model_id = u.id
WHERE ct.period_date = '2026-01-01'
ORDER BY ct.total_usd_bruto DESC;

-- =====================================================
-- 5. BUSCAR EN DICIEMBRE 2025 (por si está ahí)
-- =====================================================

SELECT 
    '5. DICIEMBRE 2025 P2' as busqueda,
    COUNT(*) as registros_history,
    COUNT(DISTINCT model_id) as modelos
FROM calculator_history
WHERE period_date = '2025-12-16'
  AND period_type = '16-31';

-- =====================================================
-- 6. BUSCAR EN FECHAS INCORRECTAS
-- =====================================================

-- 6.1. 2026-01-16 (por si se guardó como P2)
SELECT 
    '6.1 2026-01-16 (error P2)' as busqueda,
    COUNT(*) as registros
FROM calculator_history
WHERE period_date = '2026-01-16'
  AND period_type = '16-31';

-- 6.2. 2027 (error de año hacia adelante)
SELECT 
    '6.2 ENERO 2027 (error futuro)' as busqueda,
    COUNT(*) as registros
FROM calculator_history
WHERE period_date >= '2027-01-01'
  AND period_date <= '2027-01-31';

-- =====================================================
-- 7. TABLA DE LOG DE BORRADOS (si existe)
-- =====================================================

-- Verificar si existe la tabla
SELECT 
    '7. TABLA DE LOG' as info,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'model_values_deletion_log'
        ) THEN 'EXISTE'
        ELSE 'NO EXISTE'
    END as estado;

-- Si existe, buscar borrados del 15-17 enero
-- (Descomenta si la tabla existe)
/*
SELECT 
    '7. BORRADOS DEL LOG' as busqueda,
    COUNT(*) as total_borrados,
    COUNT(DISTINCT model_id) as modelos_afectados,
    SUM(CASE WHEN archived_first THEN 1 ELSE 0 END) as con_archivo,
    SUM(CASE WHEN NOT archived_first THEN 1 ELSE 0 END) as sin_archivo
FROM model_values_deletion_log
WHERE deleted_at >= '2026-01-15'
  AND deleted_at <= '2026-01-17';
*/

-- =====================================================
-- 8. RESUMEN FINAL
-- =====================================================

SELECT 
    'RESUMEN FINAL' as tipo,
    'calculator_history (2026-01-01)' as tabla,
    COUNT(*) as registros
FROM calculator_history
WHERE period_date = '2026-01-01' AND period_type = '1-15'

UNION ALL

SELECT 
    'RESUMEN FINAL',
    'model_values (2026-01-01 a 15)',
    COUNT(*)
FROM model_values
WHERE period_date >= '2026-01-01' AND period_date <= '2026-01-15'

UNION ALL

SELECT 
    'RESUMEN FINAL',
    'calculator_totals (2026-01-01)',
    COUNT(*)
FROM calculator_totals
WHERE period_date = '2026-01-01'

UNION ALL

SELECT 
    'RESUMEN FINAL',
    'calc_snapshots (15-17 ene)',
    COUNT(*)
FROM calc_snapshots
WHERE created_at >= '2026-01-15' AND created_at <= '2026-01-17';

-- =====================================================
-- 9. SI ENCUENTRAS DATOS - UBICACIÓN EXACTA
-- =====================================================

-- Esta consulta te dirá DÓNDE están los datos (si existen)
SELECT 
    '¿DÓNDE ESTÁN LOS DATOS?' as pregunta,
    CASE 
        WHEN EXISTS (SELECT 1 FROM calculator_history WHERE period_date = '2026-01-01' AND period_type = '1-15') 
        THEN '✅ EN CALCULATOR_HISTORY (2026-01-01)'
        WHEN EXISTS (SELECT 1 FROM calculator_history WHERE period_date = '2025-01-01' AND period_type = '1-15') 
        THEN '⚠️ EN CALCULATOR_HISTORY (2025-01-01 - ERROR DE AÑO)'
        WHEN EXISTS (SELECT 1 FROM model_values WHERE period_date >= '2026-01-01' AND period_date <= '2026-01-15') 
        THEN '🎉 EN MODEL_VALUES (NO SE BORRARON)'
        WHEN EXISTS (SELECT 1 FROM calc_snapshots WHERE created_at >= '2026-01-15' AND created_at <= '2026-01-17') 
        THEN '💾 EN CALC_SNAPSHOTS (HAY BACKUP)'
        ELSE '❌ NO ENCONTRADOS EN NINGUNA PARTE'
    END as ubicacion;
