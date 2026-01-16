-- =====================================================
-- 🔍 ANALIZAR BACKUPS EN CALC_SNAPSHOTS
-- =====================================================
-- Verificar si los backups tienen el detalle por plataforma
-- para recuperar el historial completo
-- =====================================================

-- =====================================================
-- 1. VERIFICAR SI EXISTEN BACKUPS
-- =====================================================

SELECT 
    '1. BACKUPS EXISTENTES' as seccion,
    COUNT(*) as total_backups,
    COUNT(DISTINCT model_id) as modelos_con_backup,
    MIN(created_at) as primer_backup,
    MAX(created_at) as ultimo_backup,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ HAY BACKUPS - Podemos recuperar'
        ELSE '❌ NO HAY BACKUPS'
    END as estado
FROM calc_snapshots
WHERE created_at >= '2026-01-15 00:00:00'
  AND created_at <= '2026-01-17 23:59:59';

-- =====================================================
-- 2. ANALIZAR ESTRUCTURA DEL JSON
-- =====================================================

-- Ver un ejemplo de backup para entender la estructura
SELECT 
    '2. EJEMPLO DE BACKUP' as seccion,
    id as backup_id,
    model_id,
    created_at,
    totals_json->>'period_date' as period_date,
    totals_json->>'period_type' as period_type,
    jsonb_array_length(COALESCE(totals_json->'values', '[]'::jsonb)) as cantidad_valores,
    totals_json->'values'->0 as primer_valor_ejemplo,
    totals_json as json_completo
FROM calc_snapshots
WHERE created_at >= '2026-01-15'
  AND created_at <= '2026-01-17'
ORDER BY created_at
LIMIT 1;

-- =====================================================
-- 3. CONTAR VALORES POR MODELO EN BACKUPS
-- =====================================================

SELECT 
    '3. VALORES POR MODELO' as seccion,
    model_id,
    created_at,
    totals_json->>'period_date' as period_date,
    jsonb_array_length(COALESCE(totals_json->'values', '[]'::jsonb)) as plataformas,
    CASE 
        WHEN jsonb_array_length(COALESCE(totals_json->'values', '[]'::jsonb)) > 1 
        THEN '✅ Tiene detalle por plataforma'
        WHEN jsonb_array_length(COALESCE(totals_json->'values', '[]'::jsonb)) = 1 
        THEN '⚠️ Solo 1 plataforma'
        ELSE '❌ Sin valores'
    END as estado
FROM calc_snapshots
WHERE created_at >= '2026-01-15'
  AND created_at <= '2026-01-17'
ORDER BY model_id;

-- =====================================================
-- 4. EXTRAER MUESTRA DE VALORES DEL JSON
-- =====================================================

-- Expandir el array de values para ver qué contiene
SELECT 
    '4. MUESTRA DE VALORES' as seccion,
    cs.model_id,
    cs.created_at,
    value_element->>'platform_id' as platform_id,
    value_element->>'value' as value,
    value_element->>'period_date' as period_date_value
FROM calc_snapshots cs,
     jsonb_array_elements(cs.totals_json->'values') as value_element
WHERE cs.created_at >= '2026-01-15'
  AND cs.created_at <= '2026-01-17'
ORDER BY cs.model_id, value_element->>'platform_id'
LIMIT 30;

-- =====================================================
-- 5. ESTADÍSTICAS DE RECUPERACIÓN POSIBLE
-- =====================================================

SELECT 
    '5. ESTADÍSTICAS' as seccion,
    COUNT(DISTINCT cs.model_id) as modelos_con_backup,
    SUM(jsonb_array_length(COALESCE(cs.totals_json->'values', '[]'::jsonb))) as total_valores_recuperables,
    AVG(jsonb_array_length(COALESCE(cs.totals_json->'values', '[]'::jsonb))) as promedio_valores_por_modelo,
    COUNT(DISTINCT value_element->>'platform_id') as plataformas_unicas
FROM calc_snapshots cs,
     jsonb_array_elements(cs.totals_json->'values') as value_element
WHERE cs.created_at >= '2026-01-15'
  AND cs.created_at <= '2026-01-17';

-- =====================================================
-- 6. COMPARAR CON LOS CONSOLIDADOS ACTUALES
-- =====================================================

WITH backup_data AS (
    SELECT 
        cs.model_id,
        SUM((value_element->>'value')::numeric) as suma_desde_backup
    FROM calc_snapshots cs,
         jsonb_array_elements(cs.totals_json->'values') as value_element
    WHERE cs.created_at >= '2026-01-15'
      AND cs.created_at <= '2026-01-17'
    GROUP BY cs.model_id
),
history_data AS (
    SELECT 
        model_id,
        value_usd_bruto as suma_en_history
    FROM calculator_history
    WHERE period_date = '2026-01-01'
      AND period_type = '1-15'
      AND platform_id = '__CONSOLIDATED_TOTAL__'
)
SELECT 
    '6. COMPARACIÓN' as seccion,
    COALESCE(b.model_id, h.model_id) as model_id,
    b.suma_desde_backup,
    h.suma_en_history,
    CASE 
        WHEN ABS(COALESCE(b.suma_desde_backup, 0) - COALESCE(h.suma_en_history, 0)) < 0.01 
        THEN '✅ COINCIDEN'
        ELSE '⚠️ DIFERENCIA: ' || (COALESCE(b.suma_desde_backup, 0) - COALESCE(h.suma_en_history, 0))::text
    END as validacion
FROM backup_data b
FULL OUTER JOIN history_data h ON b.model_id = h.model_id
ORDER BY b.model_id
LIMIT 10;

-- =====================================================
-- 7. CONCLUSIÓN
-- =====================================================

SELECT 
    '7. CONCLUSIÓN' as seccion,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM calc_snapshots cs,
                 jsonb_array_elements(cs.totals_json->'values') as value_element
            WHERE cs.created_at >= '2026-01-15'
              AND cs.created_at <= '2026-01-17'
            LIMIT 1
        )
        THEN '✅ HAY BACKUPS CON DETALLE - Podemos recuperar el historial completo por plataforma'
        ELSE '❌ NO HAY BACKUPS O NO TIENEN DETALLE - Solo podemos usar los consolidados'
    END as resultado,
    CASE 
        WHEN (
            SELECT AVG(jsonb_array_length(COALESCE(totals_json->'values', '[]'::jsonb)))
            FROM calc_snapshots
            WHERE created_at >= '2026-01-15'
              AND created_at <= '2026-01-17'
        ) > 1
        THEN '🎉 Los backups tienen MÚLTIPLES plataformas por modelo'
        WHEN (
            SELECT AVG(jsonb_array_length(COALESCE(totals_json->'values', '[]'::jsonb)))
            FROM calc_snapshots
            WHERE created_at >= '2026-01-15'
              AND created_at <= '2026-01-17'
        ) = 1
        THEN '⚠️ Los backups solo tienen 1 registro por modelo (consolidado)'
        ELSE NULL
    END as detalle;
