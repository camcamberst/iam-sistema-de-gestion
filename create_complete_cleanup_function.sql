-- =====================================================
-- 🔄 FUNCIÓN SQL PARA LIMPIEZA COMPLETA DE CALCULADORAS
-- =====================================================
-- Función que limpia TODAS las tablas relacionadas con calculadoras
-- Para ser usada por el cron job automático
-- =====================================================

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

-- =====================================================
-- 🔧 FUNCIÓN AUXILIAR PARA LIMPIEZA POR RANGO DE FECHAS
-- =====================================================
-- Función para limpiar múltiples fechas (útil para limpieza manual)
-- =====================================================

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

-- =====================================================
-- 📝 COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================

COMMENT ON FUNCTION cleanup_calculator_period(DATE, TEXT) IS 
'Limpia completamente un período de calculadora: archiva valores, elimina datos actuales y envía notificaciones';

COMMENT ON FUNCTION cleanup_calculator_date_range(DATE, DATE, TEXT) IS 
'Limpia un rango de fechas de calculadora usando la función de limpieza individual';

-- =====================================================
-- ✅ EJEMPLOS DE USO:
-- =====================================================
-- 
-- -- Limpiar un período específico
-- SELECT cleanup_calculator_period('2025-10-15', '1-15');
-- 
-- -- Limpiar un rango de fechas
-- SELECT cleanup_calculator_date_range('2025-10-01', '2025-10-15', '1-15');
-- 
-- =====================================================
