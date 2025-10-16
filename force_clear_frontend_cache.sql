-- =====================================================
-- 🔄 FORZAR LIMPIEZA DE CACHE DEL FRONTEND
-- =====================================================
-- Script SQL para crear notificaciones que fuercen la limpieza
-- del cache del frontend para todas las modelos
-- =====================================================

-- 1. Crear notificaciones de limpieza para TODAS las modelos activas
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
        'reason', 'Forzar limpieza de cache del frontend',
        'timestamp', NOW()::text,
        'action', 'clear_calculator_values',
        'force_clear', true,
        'clear_localStorage', true,
        'clear_sessionStorage', true
    ) AS notification_data,
    '2025-10-15'::date AS period_date,
    NOW() + INTERVAL '24 hours' AS expires_at
FROM users u
WHERE u.role = 'modelo' 
    AND u.is_active = true;

-- 2. Verificar notificaciones creadas
SELECT 
    'NOTIFICACIONES DE LIMPIEZA CREADAS' AS accion,
    COUNT(*) AS total_notificaciones,
    COUNT(DISTINCT model_id) AS modelos_notificadas
FROM calculator_notifications 
WHERE period_date = '2025-10-15'::date 
AND notification_type = 'calculator_cleared'
AND created_at >= NOW() - INTERVAL '1 minute';

-- 3. Mostrar lista de modelos que recibirán la notificación
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

-- 4. Verificar que no hay valores en model_values para el período
SELECT 
    'VERIFICACIÓN MODEL_VALUES' AS accion,
    COUNT(*) AS valores_restantes,
    COUNT(DISTINCT model_id) AS modelos_con_valores
FROM model_values 
WHERE period_date = '2025-10-15'::date;

-- =====================================================
-- ✅ INSTRUCCIONES PARA LAS MODELOS:
-- =====================================================
-- 1. Las modelos deben cerrar sesión y volver a iniciar sesión
-- 2. O simplemente refrescar la página de "Mi Calculadora"
-- 3. El sistema detectará la notificación y limpiará automáticamente:
--    - Valores de plataformas
--    - localStorage
--    - sessionStorage
--    - Cache del navegador
-- =====================================================
