-- =====================================================
-- 🔍 BÚSQUEDA EXHAUSTIVA: P1 ENERO 2026
-- =====================================================
-- Este script busca los datos del P1 en TODAS las tablas
-- y con TODAS las variaciones posibles de fecha
-- =====================================================

\echo '═══════════════════════════════════════════════════════════════════'
\echo '🔍 BÚSQUEDA EXHAUSTIVA: P1 ENERO 2026'
\echo '═══════════════════════════════════════════════════════════════════'
\echo ''

-- =====================================================
-- 1. BUSCAR EN CALCULATOR_HISTORY
-- =====================================================

\echo '📊 1. BUSCANDO EN CALCULATOR_HISTORY...'
\echo ''

-- 1.1. Con fecha correcta (2026-01-01)
\echo '   1.1. Fecha correcta (2026-01-01):'
SELECT 
    'calculator_history' as tabla,
    '2026-01-01' as fecha_buscada,
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
\echo '   1.2. Con error de año (2025-01-01):'
SELECT 
    'calculator_history' as tabla,
    '2025-01-01' as fecha_buscada,
    COUNT(*) as total_registros,
    COUNT(DISTINCT model_id) as modelos_unicos,
    COUNT(DISTINCT platform_id) as plataformas_unicas
FROM calculator_history
WHERE period_date = '2025-01-01'
AND period_type = '1-15';

-- 1.3. Cualquier fecha de enero 2026
\echo '   1.3. Cualquier fecha de enero 2026:'
SELECT 
    period_date,
    period_type,
    COUNT(*) as registros,
    COUNT(DISTINCT model_id) as modelos
FROM calculator_history
WHERE period_date >= '2026-01-01'
AND period_date <= '2026-01-31'
GROUP BY period_date, period_type
ORDER BY period_date;

-- 1.4. Buscar por created_at/archived_at (puede estar con otra period_date)
\echo '   1.4. Por fecha de creación (15-17 enero 2026):'
SELECT 
    period_date,
    period_type,
    COUNT(*) as registros,
    COUNT(DISTINCT model_id) as modelos,
    MIN(archived_at) as primer_archivo,
    MAX(archived_at) as ultimo_archivo
FROM calculator_history
WHERE (
    archived_at >= '2026-01-15' 
    AND archived_at <= '2026-01-17'
)
OR (
    created_at >= '2026-01-15'
    AND created_at <= '2026-01-17'
)
GROUP BY period_date, period_type
ORDER BY period_date;

-- =====================================================
-- 2. BUSCAR EN MODEL_VALUES (por si no se borraron)
-- =====================================================

\echo ''
\echo '📊 2. BUSCANDO EN MODEL_VALUES...'
\echo ''

-- 2.1. Rango del P1 (2026-01-01 a 2026-01-15)
\echo '   2.1. Rango P1 (2026-01-01 a 2026-01-15):'
SELECT 
    'model_values' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT model_id) as modelos_unicos,
    COUNT(DISTINCT platform_id) as plataformas_unicas,
    MIN(period_date) as fecha_minima,
    MAX(period_date) as fecha_maxima
FROM model_values
WHERE period_date >= '2026-01-01'
AND period_date <= '2026-01-15';

-- 2.2. Con error de año (2025-01-01 a 2025-01-15)
\echo '   2.2. Con error de año (2025-01-01 a 2025-01-15):'
SELECT 
    'model_values' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT model_id) as modelos_unicos,
    MIN(period_date) as fecha_minima,
    MAX(period_date) as fecha_maxima
FROM model_values
WHERE period_date >= '2025-01-01'
AND period_date <= '2025-01-15';

-- 2.3. Detalle por fecha específica
\echo '   2.3. Detalle por fecha específica en enero 2026:'
SELECT 
    period_date,
    COUNT(*) as registros,
    COUNT(DISTINCT model_id) as modelos,
    COUNT(DISTINCT platform_id) as plataformas
FROM model_values
WHERE period_date >= '2026-01-01'
AND period_date <= '2026-01-31'
GROUP BY period_date
ORDER BY period_date;

-- =====================================================
-- 3. BUSCAR EN CALC_SNAPSHOTS
-- =====================================================

\echo ''
\echo '📊 3. BUSCANDO EN CALC_SNAPSHOTS...'
\echo ''

-- 3.1. Por created_at (backups del 15-17 enero)
\echo '   3.1. Por fecha de creación (15-17 enero 2026):'
SELECT 
    'calc_snapshots' as tabla,
    COUNT(*) as total_snapshots,
    COUNT(DISTINCT model_id) as modelos_unicos,
    MIN(created_at) as primer_snapshot,
    MAX(created_at) as ultimo_snapshot
FROM calc_snapshots
WHERE created_at >= '2026-01-15'
AND created_at <= '2026-01-17';

-- 3.2. Buscar en el JSON (totals_json puede tener referencias)
\echo '   3.2. Buscando en totals_json (referencias a 2026-01):'
SELECT 
    id,
    model_id,
    created_at,
    totals_json->>'period_date' as period_date_en_json,
    totals_json->>'period_type' as period_type_en_json,
    (totals_json->>'values')::jsonb->0->>'value' as primer_valor
FROM calc_snapshots
WHERE totals_json::text ILIKE '%2026-01%'
LIMIT 10;

-- =====================================================
-- 4. BUSCAR EN CALCULATOR_TOTALS
-- =====================================================

\echo ''
\echo '📊 4. BUSCANDO EN CALCULATOR_TOTALS...'
\echo ''

-- 4.1. Fecha correcta (2026-01-01)
\echo '   4.1. Fecha correcta (2026-01-01):'
SELECT 
    'calculator_totals' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT model_id) as modelos_unicos,
    SUM(total_usd_bruto::numeric) as suma_usd_bruto,
    MIN(updated_at) as primera_actualizacion,
    MAX(updated_at) as ultima_actualizacion
FROM calculator_totals
WHERE period_date = '2026-01-01';

-- 4.2. Error de año (2025-01-01)
\echo '   4.2. Con error de año (2025-01-01):'
SELECT 
    'calculator_totals' as tabla,
    COUNT(*) as total_registros,
    COUNT(DISTINCT model_id) as modelos_unicos,
    SUM(total_usd_bruto::numeric) as suma_usd_bruto
FROM calculator_totals
WHERE period_date = '2025-01-01';

-- 4.3. Cualquier fecha de enero 2026
\echo '   4.3. Todas las fechas de enero 2026:'
SELECT 
    period_date,
    COUNT(*) as registros,
    SUM(total_usd_bruto::numeric) as suma_usd_bruto
FROM calculator_totals
WHERE period_date >= '2026-01-01'
AND period_date <= '2026-01-31'
GROUP BY period_date
ORDER BY period_date;

-- =====================================================
-- 5. BUSCAR EN MODEL_VALUES_DELETION_LOG (nueva tabla)
-- =====================================================

\echo ''
\echo '📊 5. BUSCANDO EN MODEL_VALUES_DELETION_LOG...'
\echo ''

-- 5.1. Borrados del 15-17 enero
\echo '   5.1. Borrados del 15-17 enero:'
SELECT 
    'model_values_deletion_log' as tabla,
    COUNT(*) as total_borrados,
    COUNT(DISTINCT model_id) as modelos_afectados,
    COUNT(DISTINCT platform_id) as plataformas,
    SUM(CASE WHEN archived_first THEN 1 ELSE 0 END) as con_archivo,
    SUM(CASE WHEN NOT archived_first THEN 1 ELSE 0 END) as sin_archivo,
    MIN(deleted_at) as primer_borrado,
    MAX(deleted_at) as ultimo_borrado
FROM model_values_deletion_log
WHERE deleted_at >= '2026-01-15'
AND deleted_at <= '2026-01-17';

-- 5.2. Detalle de borrados sin archivo
\echo '   5.2. Detalle de los primeros 10 borrados sin archivo:'
SELECT 
    model_id,
    platform_id,
    value,
    period_date,
    deleted_at,
    archived_first
FROM model_values_deletion_log
WHERE deleted_at >= '2026-01-15'
AND deleted_at <= '2026-01-17'
AND archived_first = FALSE
ORDER BY deleted_at
LIMIT 10;

-- =====================================================
-- 6. BUSCAR EN CALCULATOR_PERIOD_CLOSURE_STATUS
-- =====================================================

\echo ''
\echo '📊 6. BUSCANDO EN CALCULATOR_PERIOD_CLOSURE_STATUS...'
\echo ''

-- 6.1. Registros de enero 2026
\echo '   6.1. Registros de enero 2026:'
SELECT 
    period_date,
    period_type,
    status,
    created_at,
    updated_at,
    metadata
FROM calculator_period_closure_status
WHERE period_date >= '2026-01-01'
AND period_date <= '2026-01-31'
ORDER BY period_date, created_at;

-- 6.2. Error de año (enero 2025)
\echo '   6.2. Con error de año (enero 2025):'
SELECT 
    period_date,
    period_type,
    status,
    created_at
FROM calculator_period_closure_status
WHERE period_date >= '2025-01-01'
AND period_date <= '2025-01-31'
ORDER BY period_date;

-- =====================================================
-- 7. BUSCAR EN TODAS LAS TABLAS CON PERIOD_DATE
-- =====================================================

\echo ''
\echo '📊 7. BUSCANDO EN TODAS LAS TABLAS CON PERIOD_DATE...'
\echo ''

-- Listar todas las tablas que tienen columna period_date
\echo '   7.1. Tablas con columna period_date:'
SELECT 
    table_name,
    column_name
FROM information_schema.columns
WHERE column_name = 'period_date'
AND table_schema = 'public'
ORDER BY table_name;

-- =====================================================
-- 8. MUESTRA DE DATOS (si existen)
-- =====================================================

\echo ''
\echo '📊 8. MUESTRA DE DATOS (si existen)...'
\echo ''

-- 8.1. Primeros 5 registros de calculator_history para 2026-01
\echo '   8.1. Muestra de calculator_history (2026-01-01):'
SELECT 
    model_id,
    platform_id,
    value,
    value_usd_bruto,
    value_usd_modelo,
    period_date,
    period_type,
    archived_at
FROM calculator_history
WHERE period_date = '2026-01-01'
AND period_type = '1-15'
LIMIT 5;

-- 8.2. Primeros 5 registros de model_values (si existen)
\echo '   8.2. Muestra de model_values (enero 2026):'
SELECT 
    model_id,
    platform_id,
    value,
    period_date,
    created_at
FROM model_values
WHERE period_date >= '2026-01-01'
AND period_date <= '2026-01-15'
LIMIT 5;

-- =====================================================
-- 9. VERIFICAR SI HAY DATOS "FANTASMA" EN OTRAS FECHAS
-- =====================================================

\echo ''
\echo '📊 9. BUSCANDO DATOS "FANTASMA" EN FECHAS CERCANAS...'
\echo ''

-- 9.1. Diciembre 2025 (por si se guardó en el mes anterior)
\echo '   9.1. Diciembre 2025 P2:'
SELECT 
    'calculator_history' as tabla,
    period_date,
    period_type,
    COUNT(*) as registros,
    COUNT(DISTINCT model_id) as modelos
FROM calculator_history
WHERE period_date = '2025-12-16'
AND period_type = '16-31'
GROUP BY period_date, period_type;

-- 9.2. Enero 2027 (por si hay error de año hacia adelante)
\echo '   9.2. Enero 2027 (error futuro):'
SELECT 
    'calculator_history' as tabla,
    period_date,
    period_type,
    COUNT(*) as registros
FROM calculator_history
WHERE period_date >= '2027-01-01'
AND period_date <= '2027-01-15'
GROUP BY period_date, period_type;

-- =====================================================
-- RESUMEN FINAL
-- =====================================================

\echo ''
\echo '═══════════════════════════════════════════════════════════════════'
\echo '📊 RESUMEN FINAL'
\echo '═══════════════════════════════════════════════════════════════════'
\echo ''

SELECT 
    'RESUMEN' as tipo,
    'calculator_history (2026-01-01)' as tabla,
    COUNT(*) as registros
FROM calculator_history
WHERE period_date = '2026-01-01'
AND period_type = '1-15'

UNION ALL

SELECT 
    'RESUMEN' as tipo,
    'model_values (2026-01-01 a 15)' as tabla,
    COUNT(*) as registros
FROM model_values
WHERE period_date >= '2026-01-01'
AND period_date <= '2026-01-15'

UNION ALL

SELECT 
    'RESUMEN' as tipo,
    'calculator_totals (2026-01-01)' as tabla,
    COUNT(*) as registros
FROM calculator_totals
WHERE period_date = '2026-01-01'

UNION ALL

SELECT 
    'RESUMEN' as tipo,
    'calc_snapshots (15-17 ene)' as tabla,
    COUNT(*) as registros
FROM calc_snapshots
WHERE created_at >= '2026-01-15'
AND created_at <= '2026-01-17';

\echo ''
\echo '✅ Búsqueda exhaustiva completada'
\echo ''
