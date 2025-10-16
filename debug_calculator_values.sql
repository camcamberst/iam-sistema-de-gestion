-- =====================================================
-- 🔍 DEBUG: VERIFICAR ESTADO DE LAS CALCULADORAS
-- =====================================================
-- Script SQL para diagnosticar por qué las calculadoras siguen mostrando valores
-- =====================================================

-- 1. Verificar valores en model_values para el período 1-15
SELECT 
    'VALORES EN MODEL_VALUES' AS tabla,
    COUNT(*) AS total_registros,
    COUNT(DISTINCT model_id) AS modelos_unicos,
    SUM(value) AS suma_total_valores
FROM model_values 
WHERE period_date = '2025-10-15'::date;

-- 2. Verificar valores archivados en calculator_history
SELECT 
    'VALORES EN CALCULATOR_HISTORY' AS tabla,
    COUNT(*) AS total_registros,
    COUNT(DISTINCT model_id) AS modelos_unicos,
    SUM(value) AS suma_total_valores
FROM calculator_history 
WHERE period_date = '2025-10-15'::date;

-- 3. Verificar notificaciones creadas
SELECT 
    'NOTIFICACIONES CREADAS' AS tabla,
    COUNT(*) AS total_notificaciones,
    COUNT(DISTINCT model_id) AS modelos_notificadas
FROM calculator_notifications 
WHERE period_date = '2025-10-15'::date 
AND notification_type = 'calculator_cleared';

-- 4. Verificar si hay valores en otras fechas (posible problema de timezone)
SELECT 
    'VALORES EN OTRAS FECHAS' AS info,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos
FROM model_values 
WHERE period_date >= '2025-10-14'::date 
AND period_date <= '2025-10-16'::date
GROUP BY period_date
ORDER BY period_date;

-- 5. Verificar modelos activas
SELECT 
    'MODELOS ACTIVAS' AS info,
    COUNT(*) AS total_modelos_activas
FROM users 
WHERE role = 'modelo' 
AND is_active = true;

-- 6. Verificar si hay valores para modelos específicas (ejemplo)
SELECT 
    u.email,
    u.name,
    COUNT(mv.id) AS valores_en_model_values,
    COUNT(ch.id) AS valores_en_historial,
    COUNT(cn.id) AS notificaciones_recibidas
FROM users u
LEFT JOIN model_values mv ON u.id = mv.model_id 
    AND mv.period_date = '2025-10-15'::date
LEFT JOIN calculator_history ch ON u.id = ch.model_id 
    AND ch.period_date = '2025-10-15'::date
LEFT JOIN calculator_notifications cn ON u.id = cn.model_id 
    AND cn.period_date = '2025-10-15'::date
    AND cn.notification_type = 'calculator_cleared'
WHERE u.role = 'modelo' 
    AND u.is_active = true
GROUP BY u.id, u.email, u.name
ORDER BY valores_en_model_values DESC
LIMIT 10;

-- 7. Verificar configuración de calculadora para modelos
SELECT 
    'CONFIGURACIONES ACTIVAS' AS info,
    COUNT(*) AS configuraciones_activas
FROM calculator_config 
WHERE active = true;

-- 8. Verificar si hay valores en fechas recientes (últimos 7 días)
SELECT 
    'VALORES RECIENTES' AS info,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos
FROM model_values 
WHERE period_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY period_date
ORDER BY period_date DESC;

-- =====================================================
-- 🔍 DIAGNÓSTICO:
-- =====================================================
-- Si model_values tiene registros para '2025-10-15':
--   - El script de limpieza no funcionó completamente
--   - Necesitamos ejecutar la limpieza nuevamente
-- 
-- Si model_values está vacío pero las calculadoras muestran valores:
--   - El problema está en el cache del frontend
--   - Necesitamos forzar la limpieza del cache
-- 
-- Si hay valores en otras fechas:
--   - Posible problema de timezone
--   - El frontend puede estar cargando valores de fechas incorrectas
-- =====================================================
