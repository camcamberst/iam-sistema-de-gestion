-- =====================================================
-- 🔍 DIAGNÓSTICO DE CALCULATOR_HISTORY
-- =====================================================
-- Script SQL para diagnosticar qué datos hay en calculator_history
-- =====================================================

-- 1. Verificar todos los datos en calculator_history
SELECT 
    'TODOS LOS DATOS EN CALCULATOR_HISTORY' AS info,
    model_id,
    platform_id,
    value,
    period_date,
    period_type,
    archived_at,
    original_updated_at
FROM calculator_history 
ORDER BY archived_at DESC, period_date DESC;

-- 2. Resumen por período
SELECT 
    'RESUMEN POR PERÍODO' AS info,
    period_type,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    COUNT(DISTINCT platform_id) AS plataformas,
    SUM(value) AS total_valor,
    MIN(archived_at) AS primer_archivo,
    MAX(archived_at) AS ultimo_archivo
FROM calculator_history 
GROUP BY period_type, period_date
ORDER BY period_date DESC, period_type;

-- 3. Verificar si hay datos del período 2 (16-31) que no deberían existir
SELECT 
    'DATOS DEL PERÍODO 2 (16-31) - NO DEBERÍAN EXISTIR' AS info,
    period_type,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(value) AS total_valor,
    MIN(archived_at) AS primer_archivo,
    MAX(archived_at) AS ultimo_archivo
FROM calculator_history 
WHERE period_type = '16-31'
GROUP BY period_type, period_date
ORDER BY period_date DESC;

-- 4. Verificar datos del período 1 (1-15)
SELECT 
    'DATOS DEL PERÍODO 1 (1-15)' AS info,
    period_type,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(value) AS total_valor,
    MIN(archived_at) AS primer_archivo,
    MAX(archived_at) AS ultimo_archivo
FROM calculator_history 
WHERE period_type = '1-15'
GROUP BY period_type, period_date
ORDER BY period_date DESC;

-- 5. Verificar si hay valores duplicados o incorrectos
SELECT 
    'VERIFICAR DUPLICADOS' AS info,
    model_id,
    platform_id,
    period_date,
    period_type,
    COUNT(*) AS cantidad_registros,
    SUM(value) AS suma_valores
FROM calculator_history 
GROUP BY model_id, platform_id, period_date, period_type
HAVING COUNT(*) > 1
ORDER BY cantidad_registros DESC;

-- 6. Verificar valores por modelo
SELECT 
    'VALORES POR MODELO' AS info,
    model_id,
    period_type,
    COUNT(*) AS registros,
    COUNT(DISTINCT platform_id) AS plataformas,
    SUM(value) AS total_valor
FROM calculator_history 
GROUP BY model_id, period_type
ORDER BY model_id, period_type;

-- 7. Verificar fechas de archivo vs fechas de período
SELECT 
    'ANÁLISIS DE FECHAS' AS info,
    period_date,
    period_type,
    COUNT(*) AS registros,
    MIN(archived_at) AS primer_archivo,
    MAX(archived_at) AS ultimo_archivo,
    -- Verificar si archived_at es posterior a period_date
    COUNT(CASE WHEN archived_at::date > period_date THEN 1 END) AS archivos_posteriores
FROM calculator_history 
GROUP BY period_date, period_type
ORDER BY period_date DESC;

-- =====================================================
-- 🔍 DIAGNÓSTICO:
-- =====================================================
-- Este script nos dirá:
-- 1. Qué datos exactos hay en calculator_history
-- 2. Si hay datos del período 2 que no deberían existir
-- 3. Si hay valores duplicados o incorrectos
-- 4. Si las fechas de archivo son correctas
-- 5. Qué modelos tienen datos y en qué períodos
-- =====================================================
