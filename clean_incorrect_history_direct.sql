-- =====================================================
-- 🔄 LIMPIAR DATOS INCORRECTOS DEL HISTORIAL - DIRECTO
-- =====================================================
-- Script SQL para limpiar datos incorrectos en calculator_history
-- Basado en los logs del navegador que muestran 94 registros
-- =====================================================

-- 0. Verificar estado ANTES de la limpieza
SELECT 
    'ANTES DE LIMPIEZA - calculator_history' AS estado,
    period_type,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(value) AS total_valor
FROM calculator_history 
GROUP BY period_type
ORDER BY period_type;

-- 1. Verificar datos específicos del usuario problemático
SELECT 
    'DATOS DEL USUARIO ESPECÍFICO' AS info,
    model_id,
    period_type,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT platform_id) AS plataformas,
    SUM(value) AS total_valor,
    MIN(archived_at) AS primer_archivo,
    MAX(archived_at) AS ultimo_archivo
FROM calculator_history 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
GROUP BY model_id, period_type, period_date
ORDER BY period_date DESC, period_type;

-- 2. Eliminar datos del período 2 (16-31) que no deberían existir
-- (porque es el período en curso)
DELETE FROM calculator_history 
WHERE period_type = '16-31';

-- 3. Verificar si hay datos duplicados en el período 1
-- (mantener solo el registro más reciente por modelo+plataforma+fecha)
WITH duplicates AS (
    SELECT 
        model_id,
        platform_id,
        period_date,
        period_type,
        MAX(archived_at) AS latest_archived_at
    FROM calculator_history 
    WHERE period_type = '1-15'
    GROUP BY model_id, platform_id, period_date, period_type
    HAVING COUNT(*) > 1
)
DELETE FROM calculator_history 
WHERE period_type = '1-15'
AND (model_id, platform_id, period_date, period_type) IN (
    SELECT model_id, platform_id, period_date, period_type 
    FROM duplicates
)
AND archived_at NOT IN (
    SELECT latest_archived_at 
    FROM duplicates
);

-- 4. Verificar estado DESPUÉS de la limpieza
SELECT 
    'DESPUÉS DE LIMPIEZA - calculator_history' AS estado,
    period_type,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(value) AS total_valor
FROM calculator_history 
GROUP BY period_type
ORDER BY period_type;

-- 5. Verificar que no quedan datos del período 2
SELECT 
    'VERIFICACIÓN - NO DEBE HABER PERÍODO 2' AS accion,
    COUNT(*) AS registros_periodo_2
FROM calculator_history 
WHERE period_type = '16-31';

-- 6. Mostrar resumen final por modelo
SELECT 
    'RESUMEN FINAL POR MODELO' AS info,
    model_id,
    COUNT(*) AS registros,
    COUNT(DISTINCT platform_id) AS plataformas,
    SUM(value) AS total_valor,
    MIN(period_date) AS fecha_inicio,
    MAX(period_date) AS fecha_fin
FROM calculator_history 
WHERE period_type = '1-15'
GROUP BY model_id
ORDER BY model_id;

-- 7. Resumen final
SELECT 
    'RESUMEN FINAL' AS info,
    'Datos del período 2 (16-31) eliminados' AS accion_1,
    'Duplicados del período 1 eliminados' AS accion_2,
    'Solo debe quedar período 1 (1-15) con datos correctos' AS resultado;

-- =====================================================
-- ✅ RESULTADO ESPERADO:
-- =====================================================
-- 1. No debe haber datos del período 2 (16-31)
-- 2. No debe haber duplicados en el período 1
-- 3. Solo debe quedar período 1 (1-15) con datos correctos
-- 4. Los valores deben corresponder a la realidad
-- =====================================================
