-- =====================================================
-- 🔍 INVESTIGAR PROBLEMA DE TIMEZONE Y FECHAS
-- =====================================================
-- Script SQL para entender por qué hay valores en fechas incorrectas
-- =====================================================

-- 1. Verificar TODAS las fechas con valores en octubre
SELECT 
    'TODAS LAS FECHAS CON VALORES EN OCTUBRE' AS info,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos_unicos,
    MIN(created_at) AS primer_registro,
    MAX(created_at) AS ultimo_registro,
    MIN(updated_at) AS primera_actualizacion,
    MAX(updated_at) AS ultima_actualizacion
FROM model_values 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date
GROUP BY period_date
ORDER BY period_date;

-- 2. Verificar valores en calculator_history (archivados)
SELECT 
    'VALORES ARCHIVADOS EN OCTUBRE' AS info,
    period_date,
    COUNT(*) AS registros_archivados,
    COUNT(DISTINCT model_id) AS modelos_archivados,
    MIN(archived_at) AS primer_archivo,
    MAX(archived_at) AS ultimo_archivo
FROM calculator_history 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date
GROUP BY period_date
ORDER BY period_date;

-- 3. Verificar si hay valores en fechas futuras (más allá del 15)
SELECT 
    'VALORES EN FECHAS FUTURAS' AS info,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    STRING_AGG(DISTINCT u.email, ', ') AS emails_modelos
FROM model_values mv
JOIN users u ON mv.model_id = u.id
WHERE period_date > '2025-10-15'::date
GROUP BY period_date
ORDER BY period_date;

-- 4. Verificar timestamps de creación vs fecha del período
SELECT 
    'ANÁLISIS DE TIMESTAMPS' AS info,
    period_date,
    COUNT(*) AS registros,
    MIN(created_at) AS primer_created_at,
    MAX(created_at) AS ultimo_created_at,
    MIN(updated_at) AS primer_updated_at,
    MAX(updated_at) AS ultimo_updated_at,
    -- Verificar si created_at es anterior a period_date (datos viejos)
    COUNT(CASE WHEN created_at::date < period_date THEN 1 END) AS registros_creados_antes,
    -- Verificar si created_at es posterior a period_date (datos futuros)
    COUNT(CASE WHEN created_at::date > period_date THEN 1 END) AS registros_creados_despues
FROM model_values 
WHERE period_date >= '2025-10-14'::date 
AND period_date <= '2025-10-16'::date
GROUP BY period_date
ORDER BY period_date;

-- 5. Verificar configuración de timezone en la base de datos
SELECT 
    'CONFIGURACIÓN DE TIMEZONE' AS info,
    current_setting('timezone') AS timezone_actual,
    NOW() AS hora_actual_bd,
    getColombiaDate() AS hora_colombia_esperada;

-- 6. Verificar si hay datos de prueba o de desarrollo
SELECT 
    'ANÁLISIS DE DATOS DE PRUEBA' AS info,
    period_date,
    COUNT(*) AS registros,
    COUNT(CASE WHEN value = 0 THEN 1 END) AS valores_cero,
    COUNT(CASE WHEN value > 0 THEN 1 END) AS valores_positivos,
    AVG(value) AS promedio_valores,
    MAX(value) AS maximo_valor
FROM model_values 
WHERE period_date >= '2025-10-14'::date 
AND period_date <= '2025-10-16'::date
GROUP BY period_date
ORDER BY period_date;

-- 7. Verificar si hay valores duplicados o inconsistentes
SELECT 
    'ANÁLISIS DE DUPLICADOS' AS info,
    model_id,
    platform_id,
    period_date,
    COUNT(*) AS cantidad_registros,
    STRING_AGG(DISTINCT value::text, ', ') AS valores_diferentes,
    STRING_AGG(DISTINCT created_at::text, ', ') AS fechas_creacion
FROM model_values 
WHERE period_date >= '2025-10-14'::date 
AND period_date <= '2025-10-16'::date
GROUP BY model_id, platform_id, period_date
HAVING COUNT(*) > 1
ORDER BY cantidad_registros DESC;

-- 8. Verificar usuarios que tienen valores en fechas futuras
SELECT 
    'USUARIOS CON VALORES EN FECHAS FUTURAS' AS info,
    u.email,
    u.name,
    u.created_at AS usuario_creado,
    mv.period_date,
    COUNT(*) AS registros,
    SUM(mv.value) AS suma_valores
FROM model_values mv
JOIN users u ON mv.model_id = u.id
WHERE mv.period_date > '2025-10-15'::date
GROUP BY u.id, u.email, u.name, u.created_at, mv.period_date
ORDER BY mv.period_date, u.email;

-- =====================================================
-- 🔍 DIAGNÓSTICO ESPERADO:
-- =====================================================
-- 1. Si hay valores en fechas futuras (16+), puede ser:
--    - Datos de prueba/desarrollo
--    - Problema de timezone en la aplicación
--    - Error en la lógica de fechas del frontend
-- 
-- 2. Si created_at es posterior a period_date:
--    - Datos creados incorrectamente
--    - Problema en la lógica de asignación de fechas
-- 
-- 3. Si hay duplicados:
--    - Problema en la lógica de upsert
--    - Múltiples inserciones del mismo dato
-- =====================================================
