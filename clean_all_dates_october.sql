-- =====================================================
-- 🔄 LIMPIEZA COMPLETA DE TODAS LAS FECHAS DE OCTUBRE
-- =====================================================
-- Script SQL para limpiar TODAS las calculadoras de octubre
-- Incluye fechas 14, 15 y 16 para asegurar limpieza completa
-- =====================================================

-- 0. Verificar estado ANTES de la limpieza
SELECT 
    'ANTES DE LIMPIEZA' AS estado,
    period_date,
    COUNT(DISTINCT model_id) AS modelos_con_valores,
    COUNT(*) AS total_valores,
    SUM(value) AS suma_total_valores
FROM model_values mv
WHERE mv.period_date >= '2025-10-14'::date 
AND mv.period_date <= '2025-10-16'::date
GROUP BY period_date
ORDER BY period_date;

-- 1. Archivar TODOS los valores existentes de las fechas 14, 15 y 16
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
    CASE 
        WHEN mv.period_date = '2025-10-15'::date THEN 'quincena_1'
        ELSE 'periodo_anterior'
    END AS period_type,
    NOW() AS archived_at,
    mv.updated_at AS original_updated_at
FROM model_values mv
WHERE mv.period_date >= '2025-10-14'::date 
AND mv.period_date <= '2025-10-16'::date;

-- 2. Verificar cuántos valores se archivaron
SELECT 
    'VALORES ARCHIVADOS' AS accion,
    period_date,
    COUNT(*) AS total_archivados,
    COUNT(DISTINCT model_id) AS modelos_archivados,
    SUM(value) AS suma_archivada
FROM calculator_history 
WHERE period_date >= '2025-10-14'::date 
AND period_date <= '2025-10-16'::date
AND archived_at >= NOW() - INTERVAL '1 minute'
GROUP BY period_date
ORDER BY period_date;

-- 3. Crear notificaciones de limpieza para TODOS los modelos afectados
INSERT INTO calculator_notifications (
    model_id,
    notification_type,
    notification_data,
    period_date,
    expires_at
)
SELECT DISTINCT
    mv.model_id,
    'calculator_cleared' AS notification_type,
    jsonb_build_object(
        'type', 'calculator_cleared',
        'model_id', mv.model_id,
        'period_date', mv.period_date::text,
        'reason', 'Limpieza completa de todas las fechas de octubre',
        'timestamp', NOW()::text,
        'action', 'clear_calculator_values',
        'archived_values', true,
        'clear_all_dates', true
    ) AS notification_data,
    mv.period_date,
    NOW() + INTERVAL '24 hours' AS expires_at
FROM model_values mv
WHERE mv.period_date >= '2025-10-14'::date 
AND mv.period_date <= '2025-10-16'::date;

-- 4. ELIMINAR TODOS LOS VALORES de model_values para las fechas 14, 15 y 16
DELETE FROM model_values 
WHERE period_date >= '2025-10-14'::date 
AND period_date <= '2025-10-16'::date;

-- 5. Verificar estado DESPUÉS de la limpieza
SELECT 
    'DESPUÉS DE LIMPIEZA' AS estado,
    period_date,
    COUNT(DISTINCT model_id) AS modelos_con_valores,
    COUNT(*) AS total_valores,
    COALESCE(SUM(value), 0) AS suma_total_valores
FROM model_values mv
WHERE mv.period_date >= '2025-10-14'::date 
AND mv.period_date <= '2025-10-16'::date
GROUP BY period_date
ORDER BY period_date;

-- 6. Verificar que los valores están archivados
SELECT 
    'VERIFICACIÓN ARCHIVO' AS accion,
    period_date,
    COUNT(*) AS total_en_historial,
    COUNT(DISTINCT model_id) AS modelos_en_historial,
    SUM(value) AS suma_en_historial
FROM calculator_history 
WHERE period_date >= '2025-10-14'::date 
AND period_date <= '2025-10-16'::date
GROUP BY period_date
ORDER BY period_date;

-- 7. Verificar notificaciones creadas
SELECT 
    'NOTIFICACIONES CREADAS' AS accion,
    period_date,
    COUNT(*) AS total_notificaciones,
    COUNT(DISTINCT model_id) AS modelos_notificados
FROM calculator_notifications 
WHERE period_date >= '2025-10-14'::date 
AND period_date <= '2025-10-16'::date
AND notification_type = 'calculator_cleared'
AND created_at >= NOW() - INTERVAL '1 minute'
GROUP BY period_date
ORDER BY period_date;

-- 8. Mostrar resumen de modelos procesados
SELECT 
    u.email,
    u.name,
    COUNT(DISTINCT ch.period_date) AS fechas_archivadas,
    COUNT(ch.id) AS valores_archivados,
    SUM(ch.value) AS suma_archivada,
    CASE 
        WHEN cn.id IS NOT NULL THEN 'Notificación enviada'
        ELSE 'Sin notificación'
    END AS estado_notificacion
FROM users u
LEFT JOIN calculator_history ch ON u.id = ch.model_id 
    AND ch.period_date >= '2025-10-14'::date 
    AND ch.period_date <= '2025-10-16'::date
    AND ch.archived_at >= NOW() - INTERVAL '1 minute'
LEFT JOIN calculator_notifications cn ON u.id = cn.model_id 
    AND cn.period_date >= '2025-10-14'::date 
    AND cn.period_date <= '2025-10-16'::date
    AND cn.notification_type = 'calculator_cleared'
    AND cn.created_at >= NOW() - INTERVAL '1 minute'
WHERE u.role = 'modelo' 
    AND u.is_active = true
GROUP BY u.id, u.email, u.name, cn.id
ORDER BY valores_archivados DESC;

-- 9. Verificar que no quedan valores en ninguna fecha de octubre
SELECT 
    'VERIFICACIÓN FINAL' AS accion,
    'No debe haber valores en fechas 14, 15, 16 de octubre' AS descripcion,
    COUNT(*) AS valores_restantes
FROM model_values 
WHERE period_date >= '2025-10-14'::date 
AND period_date <= '2025-10-16'::date;

-- 10. Resumen final
SELECT 
    'RESUMEN FINAL' AS info,
    'Todas las calculadoras de octubre (14, 15, 16) han sido limpiadas' AS estado,
    'Los valores están archivados en calculator_history' AS archivado,
    'Notificaciones enviadas para limpiar cache del frontend' AS notificaciones,
    'Futuros cierres automáticos procesarán TODOS los modelos' AS futuro;

-- =====================================================
-- ✅ RESULTADO ESPERADO:
-- =====================================================
-- 1. Todas las calculadoras de las fechas 14, 15 y 16 estarán en cero
-- 2. Los valores estarán archivados en calculator_history
-- 3. Notificaciones enviadas para limpiar cache del frontend
-- 4. El cron job automático procesará TODOS los modelos en futuros cierres
-- 5. No habrá más problemas de valores persistentes
-- =====================================================
