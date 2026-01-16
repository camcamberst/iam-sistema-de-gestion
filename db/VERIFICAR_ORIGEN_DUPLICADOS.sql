-- =====================================================
-- 🔍 VERIFICAR ORIGEN DE LOS DUPLICADOS
-- =====================================================
-- Determinar si uno viene de backup y otro de recuperación
-- =====================================================

-- =====================================================
-- 1. COMPARAR FECHAS DE CREACIÓN DE AMBOS TIPOS
-- =====================================================

SELECT 
    '1. FECHAS DE CREACIÓN' as seccion,
    platform_id,
    COUNT(*) as registros,
    MIN(archived_at) as primera_creacion,
    MAX(archived_at) as ultima_creacion,
    MAX(archived_at) - MIN(archived_at) as diferencia_tiempo
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
  AND platform_id IN ('__CONSOLIDATED_TOTAL__', '__consolidated_recovery__')
GROUP BY platform_id
ORDER BY MIN(archived_at);

-- =====================================================
-- 2. VER MUESTRA DE AMBOS TIPOS CON TIMESTAMPS
-- =====================================================

SELECT 
    '2. MUESTRA CON TIMESTAMPS' as seccion,
    model_id,
    platform_id,
    value_usd_bruto,
    archived_at,
    created_at
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
  AND platform_id IN ('__CONSOLIDATED_TOTAL__', '__consolidated_recovery__')
ORDER BY model_id, archived_at
LIMIT 10;

-- =====================================================
-- 3. VERIFICAR SI HAY BACKUPS EN CALC_SNAPSHOTS
-- =====================================================

SELECT 
    '3. BACKUPS EN CALC_SNAPSHOTS' as seccion,
    COUNT(*) as total_snapshots,
    COUNT(DISTINCT model_id) as modelos_con_backup,
    MIN(created_at) as primer_backup,
    MAX(created_at) as ultimo_backup
FROM calc_snapshots
WHERE created_at >= '2026-01-15 00:00:00'
  AND created_at <= '2026-01-17 23:59:59';

-- Si hay backups, ver su estructura
SELECT 
    '3b. DETALLE DE BACKUPS' as info,
    id,
    model_id,
    created_at,
    totals_json->>'period_date' as period_date_json,
    totals_json->>'period_type' as period_type_json,
    jsonb_array_length(COALESCE(totals_json->'values', '[]'::jsonb)) as cantidad_valores_json
FROM calc_snapshots
WHERE created_at >= '2026-01-15'
  AND created_at <= '2026-01-17'
ORDER BY created_at
LIMIT 5;

-- =====================================================
-- 4. BUSCAR EN CALCULATOR_PERIOD_CLOSURE_STATUS
-- =====================================================

SELECT 
    '4. ESTADO DEL CIERRE' as seccion,
    period_date,
    period_type,
    status,
    created_at,
    updated_at,
    metadata->>'recovery_type' as tipo_recuperacion,
    metadata->>'recovered_models' as modelos_recuperados,
    metadata->>'note' as nota
FROM calculator_period_closure_status
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
ORDER BY created_at;

-- =====================================================
-- 5. COMPARAR VALORES ENTRE AMBOS CONSOLIDADOS
-- =====================================================

WITH consolidado_total AS (
    SELECT 
        model_id,
        value_usd_bruto as valor_total,
        archived_at as fecha_total
    FROM calculator_history
    WHERE period_date = '2026-01-01'
      AND period_type = '1-15'
      AND platform_id = '__CONSOLIDATED_TOTAL__'
),
consolidado_recovery AS (
    SELECT 
        model_id,
        value_usd_bruto as valor_recovery,
        archived_at as fecha_recovery
    FROM calculator_history
    WHERE period_date = '2026-01-01'
      AND period_type = '1-15'
      AND platform_id = '__consolidated_recovery__'
)
SELECT 
    '5. COMPARACIÓN DE VALORES' as seccion,
    COALESCE(ct.model_id, cr.model_id) as model_id,
    ct.valor_total,
    ct.fecha_total,
    cr.valor_recovery,
    cr.fecha_recovery,
    CASE 
        WHEN ABS(COALESCE(ct.valor_total, 0) - COALESCE(cr.valor_recovery, 0)) < 0.01 
        THEN '✅ VALORES IGUALES'
        ELSE '⚠️ VALORES DIFERENTES: ' || (COALESCE(ct.valor_total, 0) - COALESCE(cr.valor_recovery, 0))::text
    END as comparacion,
    CASE 
        WHEN ct.fecha_total < cr.fecha_recovery THEN '__CONSOLIDATED_TOTAL__ fue PRIMERO'
        WHEN cr.fecha_recovery < ct.fecha_total THEN '__consolidated_recovery__ fue PRIMERO'
        ELSE 'MISMA FECHA'
    END as orden_cronologico
FROM consolidado_total ct
FULL OUTER JOIN consolidado_recovery cr ON ct.model_id = cr.model_id
ORDER BY COALESCE(ct.model_id, cr.model_id)
LIMIT 10;

-- =====================================================
-- 6. BUSCAR PROCESO QUE CREÓ __CONSOLIDATED_TOTAL__
-- =====================================================

-- Ver si hay algún patrón en los datos
SELECT 
    '6. ANÁLISIS __CONSOLIDATED_TOTAL__' as seccion,
    COUNT(*) as total,
    MIN(archived_at) as primera_creacion,
    MAX(archived_at) as ultima_creacion,
    EXTRACT(EPOCH FROM (MAX(archived_at) - MIN(archived_at))) as segundos_diferencia,
    CASE 
        WHEN MAX(archived_at) = MIN(archived_at) THEN '✅ Todos creados al mismo tiempo (proceso batch)'
        WHEN EXTRACT(EPOCH FROM (MAX(archived_at) - MIN(archived_at))) < 60 THEN '✅ Creados en menos de 1 minuto (proceso batch rápido)'
        ELSE '⚠️ Creados en ' || ROUND(EXTRACT(EPOCH FROM (MAX(archived_at) - MIN(archived_at))) / 60) || ' minutos'
    END as tipo_proceso
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
  AND platform_id = '__CONSOLIDATED_TOTAL__';

SELECT 
    '6b. ANÁLISIS __consolidated_recovery__' as seccion,
    COUNT(*) as total,
    MIN(archived_at) as primera_creacion,
    MAX(archived_at) as ultima_creacion,
    EXTRACT(EPOCH FROM (MAX(archived_at) - MIN(archived_at))) as segundos_diferencia,
    CASE 
        WHEN MAX(archived_at) = MIN(archived_at) THEN '✅ Todos creados al mismo tiempo (mi script)'
        WHEN EXTRACT(EPOCH FROM (MAX(archived_at) - MIN(archived_at))) < 60 THEN '✅ Creados en menos de 1 minuto'
        ELSE '⚠️ Creados en ' || ROUND(EXTRACT(EPOCH FROM (MAX(archived_at) - MIN(archived_at))) / 60) || ' minutos'
    END as tipo_proceso
FROM calculator_history
WHERE period_date = '2026-01-01'
  AND period_type = '1-15'
  AND platform_id = '__consolidated_recovery__';

-- =====================================================
-- 7. VERIFICAR SI SON EXACTAMENTE DUPLICADOS
-- =====================================================

SELECT 
    '7. VERIFICACIÓN DE DUPLICADOS' as seccion,
    COUNT(*) as modelos_con_ambos_tipos,
    SUM(CASE WHEN valor_total = valor_recovery THEN 1 ELSE 0 END) as modelos_con_valores_iguales,
    SUM(CASE WHEN valor_total != valor_recovery THEN 1 ELSE 0 END) as modelos_con_valores_diferentes,
    CASE 
        WHEN COUNT(*) = SUM(CASE WHEN valor_total = valor_recovery THEN 1 ELSE 0 END) 
        THEN '✅ TODOS los valores son idénticos (son duplicados exactos)'
        ELSE '⚠️ Algunos valores son diferentes'
    END as conclusion
FROM (
    SELECT 
        ct.model_id,
        ct.value_usd_bruto as valor_total,
        cr.value_usd_bruto as valor_recovery
    FROM calculator_history ct
    INNER JOIN calculator_history cr ON ct.model_id = cr.model_id
    WHERE ct.period_date = '2026-01-01'
      AND ct.period_type = '1-15'
      AND ct.platform_id = '__CONSOLIDATED_TOTAL__'
      AND cr.period_date = '2026-01-01'
      AND cr.period_type = '1-15'
      AND cr.platform_id = '__consolidated_recovery__'
) comparacion;

-- =====================================================
-- 8. DECISIÓN: ¿QUÉ HACER?
-- =====================================================

SELECT 
    '8. RECOMENDACIÓN' as seccion,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM calculator_history 
            WHERE period_date = '2026-01-01' 
            AND period_type = '1-15' 
            AND platform_id = '__CONSOLIDATED_TOTAL__'
        ) = (
            SELECT COUNT(*) FROM calculator_history 
            WHERE period_date = '2026-01-01' 
            AND period_type = '1-15' 
            AND platform_id = '__consolidated_recovery__'
        )
        AND (
            SELECT AVG(ABS(ct.value_usd_bruto - cr.value_usd_bruto))
            FROM calculator_history ct
            INNER JOIN calculator_history cr ON ct.model_id = cr.model_id
            WHERE ct.period_date = '2026-01-01'
              AND ct.period_type = '1-15'
              AND ct.platform_id = '__CONSOLIDATED_TOTAL__'
              AND cr.period_date = '2026-01-01'
              AND cr.period_type = '1-15'
              AND cr.platform_id = '__consolidated_recovery__'
        ) < 0.01
        THEN '✅ SON DUPLICADOS EXACTOS - Eliminar uno de los dos (dejar el más reciente o __consolidated_recovery__)'
        ELSE '⚠️ SON DIFERENTES - Investigar más antes de eliminar'
    END as recomendacion;
