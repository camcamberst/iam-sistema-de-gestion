-- =====================================================
-- 🔄 LIMPIEZA FINAL DE TABLAS DE CALCULADORA
-- =====================================================
-- Script SQL para limpiar las tablas que realmente existen
-- Basado en el diagnóstico de tablas existentes
-- =====================================================

-- 0. Verificar estado ANTES de la limpieza
SELECT 
    'ANTES DE LIMPIEZA - model_values' AS tabla,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(value) AS suma_valores
FROM model_values 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date
GROUP BY period_date
ORDER BY period_date;

SELECT 
    'ANTES DE LIMPIEZA - calculator_totals' AS tabla,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(total_usd_bruto) AS suma_usd_bruto,
    SUM(total_usd_modelo) AS suma_usd_modelo
FROM calculator_totals 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date
GROUP BY period_date
ORDER BY period_date;

-- 1. Archivar valores de model_values (si hay alguno)
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
        WHEN mv.period_date <= '2025-10-15'::date THEN '1-15'
        ELSE '16-31'
    END AS period_type,
    NOW() AS archived_at,
    mv.updated_at AS original_updated_at
FROM model_values mv
WHERE mv.period_date >= '2025-10-01'::date 
AND mv.period_date <= '2025-10-31'::date;

-- 2. Crear notificaciones masivas para TODAS las modelos activas
INSERT INTO calculator_notifications (
    model_id,
    notification_type,
    notification_data,
    period_date,
    expires_at
)
SELECT 
    u.id AS model_id,
    'calculator_cleared' AS notification_type,
    jsonb_build_object(
        'type', 'calculator_cleared',
        'model_id', u.id,
        'period_date', '2025-10-15',
        'reason', 'Limpieza final de todas las calculadoras',
        'timestamp', NOW()::text,
        'action', 'clear_calculator_values',
        'force_clear', true,
        'clear_localStorage', true,
        'clear_sessionStorage', true,
        'clear_all_cache', true,
        'tables_cleaned', ARRAY['model_values', 'calculator_totals']
    ) AS notification_data,
    '2025-10-15'::date AS period_date,
    NOW() + INTERVAL '48 hours' AS expires_at
FROM users u
WHERE u.role = 'modelo' 
    AND u.is_active = true;

-- 3. ELIMINAR valores de model_values para octubre
DELETE FROM model_values 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date;

-- 4. ELIMINAR valores de calculator_totals para octubre
DELETE FROM calculator_totals 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date;

-- 5. Verificar estado DESPUÉS de la limpieza
SELECT 
    'DESPUÉS DE LIMPIEZA - model_values' AS tabla,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    COALESCE(SUM(value), 0) AS suma_valores
FROM model_values 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date
GROUP BY period_date
ORDER BY period_date;

SELECT 
    'DESPUÉS DE LIMPIEZA - calculator_totals' AS tabla,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    COALESCE(SUM(total_usd_bruto), 0) AS suma_usd_bruto,
    COALESCE(SUM(total_usd_modelo), 0) AS suma_usd_modelo
FROM calculator_totals 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date
GROUP BY period_date
ORDER BY period_date;

-- 6. Verificar notificaciones creadas
SELECT 
    'NOTIFICACIONES CREADAS' AS accion,
    COUNT(*) AS total_notificaciones,
    COUNT(DISTINCT model_id) AS modelos_notificadas
FROM calculator_notifications 
WHERE period_date = '2025-10-15'::date 
AND notification_type = 'calculator_cleared'
AND created_at >= NOW() - INTERVAL '1 minute';

-- 7. Verificar que no quedan valores en octubre
SELECT 
    'VERIFICACIÓN FINAL - model_values' AS tabla,
    COUNT(*) AS valores_restantes
FROM model_values 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date

UNION ALL

SELECT 
    'VERIFICACIÓN FINAL - calculator_totals' AS tabla,
    COUNT(*) AS valores_restantes
FROM calculator_totals 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date;

-- 8. Mostrar lista de modelos que recibirán la notificación
SELECT 
    u.email,
    u.name,
    cn.created_at AS notificacion_enviada
FROM users u
JOIN calculator_notifications cn ON u.id = cn.model_id
WHERE u.role = 'modelo' 
    AND u.is_active = true
    AND cn.period_date = '2025-10-15'::date
    AND cn.notification_type = 'calculator_cleared'
    AND cn.created_at >= NOW() - INTERVAL '1 minute'
ORDER BY u.email;

-- 9. Resumen final
SELECT 
    'RESUMEN FINAL' AS info,
    'Todas las calculadoras de octubre han sido limpiadas' AS estado,
    'Los valores están archivados en calculator_history' AS archivado,
    'Notificaciones masivas enviadas para limpiar cache del frontend' AS notificaciones,
    'Tablas limpiadas: model_values, calculator_totals' AS tablas_limpiadas,
    'Sistema unificado a timezone Colombia únicamente' AS timezone;

-- =====================================================
-- ✅ INSTRUCCIONES PARA LAS MODELOS:
-- =====================================================
-- 1. Las modelos DEBEN cerrar sesión completamente
-- 2. Limpiar cache del navegador (Ctrl+Shift+Delete)
-- 3. Volver a iniciar sesión
-- 4. Acceder a "Mi Calculadora"
-- 5. El sistema detectará la notificación y limpiará automáticamente
-- =====================================================
