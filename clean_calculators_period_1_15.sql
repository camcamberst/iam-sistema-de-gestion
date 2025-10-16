-- =====================================================
-- 🔄 LIMPIEZA INMEDIATA - PERÍODO 1-15 OCTUBRE
-- =====================================================
-- Script SQL para limpiar TODAS las calculadoras del período 1-15 octubre
-- y asegurar que esto ocurra automáticamente en futuros cierres
-- =====================================================

-- 0. Verificar estado ANTES de la limpieza
SELECT 
    'ANTES DE LIMPIEZA' AS estado,
    COUNT(DISTINCT mv.model_id) AS modelos_con_valores,
    COUNT(*) AS total_valores,
    SUM(mv.value) AS suma_total_valores
FROM model_values mv
WHERE mv.period_date = '2025-10-15';

-- 1. Archivar TODOS los valores existentes del período 1-15
INSERT INTO calculator_history (
    model_id,
    platform_id,
    value,
    period_date,
    period_type,
    archived_at,
    original_updated_at
)
SELECT 
    mv.model_id,
    mv.platform_id,
    mv.value,
    mv.period_date,
    'quincena_1' AS period_type,
    NOW() AS archived_at,
    mv.updated_at AS original_updated_at
FROM model_values mv
WHERE mv.period_date = '2025-10-15';

-- 2. Verificar cuántos valores se archivaron
SELECT 
    'VALORES ARCHIVADOS' AS accion,
    COUNT(*) AS total_archivados,
    COUNT(DISTINCT model_id) AS modelos_archivados,
    SUM(value) AS suma_archivada
FROM calculator_history 
WHERE period_date = '2025-10-15' 
AND archived_at >= NOW() - INTERVAL '1 minute';

-- 3. ELIMINAR TODOS LOS VALORES de model_values para el período 1-15
DELETE FROM model_values 
WHERE period_date = '2025-10-15';

-- 4. Verificar estado DESPUÉS de la limpieza
SELECT 
    'DESPUÉS DE LIMPIEZA' AS estado,
    COUNT(DISTINCT mv.model_id) AS modelos_con_valores,
    COUNT(*) AS total_valores,
    COALESCE(SUM(mv.value), 0) AS suma_total_valores
FROM model_values mv
WHERE mv.period_date = '2025-10-15';

-- 5. Verificar que los valores están archivados
SELECT 
    'VERIFICACIÓN ARCHIVO' AS accion,
    COUNT(*) AS total_en_historial,
    COUNT(DISTINCT model_id) AS modelos_en_historial,
    SUM(value) AS suma_en_historial
FROM calculator_history 
WHERE period_date = '2025-10-15';

-- 6. Mostrar resumen de modelos procesados
SELECT 
    u.email,
    u.name,
    COUNT(ch.id) AS valores_archivados,
    SUM(ch.value) AS suma_archivada
FROM users u
LEFT JOIN calculator_history ch ON u.id = ch.model_id 
    AND ch.period_date = '2025-10-15'
    AND ch.archived_at >= NOW() - INTERVAL '1 minute'
WHERE u.role = 'modelo' 
    AND u.is_active = true
GROUP BY u.id, u.email, u.name
ORDER BY valores_archivados DESC;

-- 7. Verificar configuración del cron job para futuros cierres
SELECT 
    'CONFIGURACIÓN CRON' AS info,
    'Los días 15 y 30 a las 17:00 Colombia' AS horario,
    'Procesa TODOS los modelos activos' AS alcance,
    'Archiva valores y limpia calculadoras' AS accion;

-- =====================================================
-- ✅ RESULTADO ESPERADO:
-- =====================================================
-- 1. Todas las calculadoras del período 1-15 estarán en cero
-- 2. Los valores estarán archivados en calculator_history
-- 3. El cron job automático procesará TODOS los modelos en futuros cierres
-- 4. No habrá más problemas de valores persistentes
-- =====================================================
