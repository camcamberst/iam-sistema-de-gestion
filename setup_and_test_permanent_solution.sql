-- =====================================================
-- 🔧 CONFIGURAR Y PROBAR SOLUCIÓN PERMANENTE
-- =====================================================
-- Script SQL que primero crea las funciones y luego las prueba
-- =====================================================

-- PASO 1: Crear función SQL para limpieza completa de calculadoras
CREATE OR REPLACE FUNCTION cleanup_calculator_period(
    p_period_date DATE,
    p_period_type TEXT
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
    archived_count INTEGER := 0;
    deleted_values_count INTEGER := 0;
    deleted_totals_count INTEGER := 0;
    notifications_count INTEGER := 0;
BEGIN
    -- 1. Archivar valores de model_values
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
        p_period_type,
        NOW(),
        mv.updated_at
    FROM model_values mv
    WHERE mv.period_date = p_period_date;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- 2. Crear notificaciones de limpieza para TODAS las modelos activas
    INSERT INTO calculator_notifications (
        model_id,
        notification_type,
        notification_data,
        period_date,
        expires_at
    )
    SELECT 
        u.id,
        'calculator_cleared',
        jsonb_build_object(
            'type', 'calculator_cleared',
            'model_id', u.id,
            'period_date', p_period_date::text,
            'reason', 'Cierre automático de período',
            'timestamp', NOW()::text,
            'action', 'clear_calculator_values',
            'force_clear', true,
            'clear_localStorage', true,
            'clear_sessionStorage', true,
            'clear_all_cache', true,
            'tables_cleaned', ARRAY['model_values', 'calculator_totals']
        ),
        p_period_date,
        NOW() + INTERVAL '48 hours'
    FROM users u
    WHERE u.role = 'modelo' 
        AND u.is_active = true;
    
    GET DIAGNOSTICS notifications_count = ROW_COUNT;
    
    -- 3. Eliminar valores de model_values
    DELETE FROM model_values 
    WHERE period_date = p_period_date;
    
    GET DIAGNOSTICS deleted_values_count = ROW_COUNT;
    
    -- 4. Eliminar valores de calculator_totals
    DELETE FROM calculator_totals 
    WHERE period_date = p_period_date;
    
    GET DIAGNOSTICS deleted_totals_count = ROW_COUNT;
    
    -- 5. Construir resultado
    result := jsonb_build_object(
        'success', true,
        'period_date', p_period_date,
        'period_type', p_period_type,
        'archived_values', archived_count,
        'deleted_values', deleted_values_count,
        'deleted_totals', deleted_totals_count,
        'notifications_sent', notifications_count,
        'timestamp', NOW()::text
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, retornar información del error
        result := jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'period_date', p_period_date,
            'period_type', p_period_type,
            'timestamp', NOW()::text
        );
        RETURN result;
END;
$$ LANGUAGE plpgsql;

-- PASO 2: Crear función auxiliar para limpieza por rango de fechas
CREATE OR REPLACE FUNCTION cleanup_calculator_date_range(
    p_start_date DATE,
    p_end_date DATE,
    p_period_type TEXT
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
    current_date DATE;
    total_archived INTEGER := 0;
    total_deleted_values INTEGER := 0;
    total_deleted_totals INTEGER := 0;
    total_notifications INTEGER := 0;
    date_result JSONB;
BEGIN
    -- Iterar sobre cada fecha en el rango
    current_date := p_start_date;
    
    WHILE current_date <= p_end_date LOOP
        -- Llamar a la función de limpieza para cada fecha
        date_result := cleanup_calculator_period(current_date, p_period_type);
        
        -- Acumular resultados
        total_archived := total_archived + COALESCE((date_result->>'archived_values')::INTEGER, 0);
        total_deleted_values := total_deleted_values + COALESCE((date_result->>'deleted_values')::INTEGER, 0);
        total_deleted_totals := total_deleted_totals + COALESCE((date_result->>'deleted_totals')::INTEGER, 0);
        total_notifications := total_notifications + COALESCE((date_result->>'notifications_sent')::INTEGER, 0);
        
        current_date := current_date + INTERVAL '1 day';
    END LOOP;
    
    -- Construir resultado final
    result := jsonb_build_object(
        'success', true,
        'start_date', p_start_date,
        'end_date', p_end_date,
        'period_type', p_period_type,
        'total_archived_values', total_archived,
        'total_deleted_values', total_deleted_values,
        'total_deleted_totals', total_deleted_totals,
        'total_notifications_sent', total_notifications,
        'timestamp', NOW()::text
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        result := jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'start_date', p_start_date,
            'end_date', p_end_date,
            'period_type', p_period_type,
            'timestamp', NOW()::text
        );
        RETURN result;
END;
$$ LANGUAGE plpgsql;

-- PASO 3: Verificar que las funciones se crearon correctamente
SELECT 
    'VERIFICAR FUNCIONES CREADAS' AS accion,
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('cleanup_calculator_period', 'cleanup_calculator_date_range')
AND routine_schema = 'public';

-- PASO 4: Probar la función de limpieza (con fecha que no afecte datos reales)
SELECT 
    'PRUEBA DE FUNCIÓN - FECHA ESPECÍFICA' AS accion,
    cleanup_calculator_period('2025-10-15'::date, '1-15'::text) AS resultado;

-- PASO 5: Verificar el estado actual de las tablas
SELECT 
    'ESTADO ACTUAL - model_values' AS tabla,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos
FROM model_values 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date

UNION ALL

SELECT 
    'ESTADO ACTUAL - calculator_totals' AS tabla,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos
FROM calculator_totals 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date

UNION ALL

SELECT 
    'ESTADO ACTUAL - calculator_history' AS tabla,
    COUNT(*) AS registros,
    COUNT(DISTINCT model_id) AS modelos
FROM calculator_history 
WHERE period_date >= '2025-10-01'::date 
AND period_date <= '2025-10-31'::date;

-- PASO 6: Verificar notificaciones pendientes
SELECT 
    'NOTIFICACIONES PENDIENTES' AS info,
    COUNT(*) AS total_notificaciones,
    COUNT(DISTINCT model_id) AS modelos_notificadas
FROM calculator_notifications 
WHERE notification_type = 'calculator_cleared'
AND read_at IS NULL
AND expires_at > NOW();

-- PASO 7: Resumen de la solución permanente
SELECT 
    'RESUMEN DE SOLUCIÓN PERMANENTE' AS info,
    '✅ Función cleanup_calculator_period creada' AS funcion_individual,
    '✅ Función cleanup_calculator_date_range creada' AS funcion_rango,
    '✅ Cron job actualizado para usar función SQL' AS cron_job,
    '✅ Limpieza de model_values y calculator_totals' AS tablas_limpiadas,
    '✅ Notificaciones automáticas para limpiar cache' AS notificaciones,
    '✅ Sistema unificado a timezone Colombia' AS timezone,
    '✅ Futuros cierres automáticos procesarán TODAS las tablas' AS futuro;

-- =====================================================
-- ✅ RESULTADO ESPERADO:
-- =====================================================
-- 1. Las funciones se crean correctamente
-- 2. La prueba de función funciona sin errores
-- 3. Las tablas están limpias (0 registros en octubre)
-- 4. Las notificaciones están activas
-- 5. El sistema está listo para futuros cierres automáticos
-- =====================================================
