-- =====================================================
-- 🔍 DEBUG: VERIFICAR ENDPOINT DE CALCULADORA
-- =====================================================
-- Script SQL para diagnosticar por qué las calculadoras siguen mostrando valores
-- =====================================================

-- 1. Verificar si hay valores en model_values para la fecha actual
SELECT 
    'VALORES EN MODEL_VALUES - FECHA ACTUAL' AS info,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(value) AS suma_valores
FROM model_values 
WHERE period_date = CURRENT_DATE
GROUP BY period_date;

-- 2. Verificar si hay valores en fechas recientes (últimos 7 días)
SELECT 
    'VALORES EN FECHAS RECIENTES' AS info,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(value) AS suma_valores
FROM model_values 
WHERE period_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY period_date
ORDER BY period_date DESC;

-- 3. Verificar si hay valores para modelos específicas
SELECT 
    'VALORES POR MODELO - ÚLTIMOS 7 DÍAS' AS info,
    u.email,
    u.name,
    mv.period_date,
    COUNT(*) AS registros,
    SUM(mv.value) AS suma_valores
FROM model_values mv
JOIN users u ON mv.model_id = u.id
WHERE mv.period_date >= CURRENT_DATE - INTERVAL '7 days'
AND u.role = 'modelo'
GROUP BY u.id, u.email, u.name, mv.period_date
ORDER BY mv.period_date DESC, u.email;

-- 4. Verificar si hay valores en localStorage/sessionStorage (simulado)
-- Esto no se puede verificar directamente desde SQL, pero podemos verificar
-- si hay notificaciones pendientes que deberían limpiar el cache
SELECT 
    'NOTIFICACIONES PENDIENTES' AS info,
    COUNT(*) AS notificaciones_pendientes,
    COUNT(DISTINCT model_id) AS modelos_con_notificaciones
FROM calculator_notifications 
WHERE notification_type = 'calculator_cleared'
AND read_at IS NULL
AND expires_at > NOW();

-- 5. Verificar configuración de calculadora para modelos
SELECT 
    'CONFIGURACIONES DE CALCULADORA' AS info,
    COUNT(*) AS configuraciones_activas,
    COUNT(DISTINCT model_id) AS modelos_configuradas
FROM calculator_config 
WHERE active = true;

-- 6. Verificar si hay valores en calculator_totals
SELECT 
    'VALORES EN CALCULATOR_TOTALS' AS info,
    period_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(total_usd_bruto) AS suma_usd_bruto,
    SUM(total_usd_modelo) AS suma_usd_modelo
FROM calculator_totals 
WHERE period_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY period_date
ORDER BY period_date DESC;

-- 7. Verificar si hay valores en daily_earnings
SELECT 
    'VALORES EN DAILY_EARNINGS' AS info,
    earning_date,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos,
    SUM(amount) AS suma_ganancias
FROM daily_earnings 
WHERE earning_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY earning_date
ORDER BY earning_date DESC;

-- =====================================================
-- 🔍 DIAGNÓSTICO:
-- =====================================================
-- Si hay valores en model_values para fechas recientes:
--   - El frontend está cargando valores de fechas incorrectas
--   - Posible problema de timezone en el frontend
-- 
-- Si hay valores en calculator_totals o daily_earnings:
--   - El frontend puede estar mostrando estos valores
--   - Necesitamos limpiar también estas tablas
-- 
-- Si hay notificaciones pendientes:
--   - El sistema de notificaciones no está funcionando
--   - Las modelos no están recibiendo las notificaciones
-- =====================================================
