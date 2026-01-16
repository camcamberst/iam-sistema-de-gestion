-- =====================================================
-- 🚨 CORRECCIÓN CRÍTICA: PREVENIR PÉRDIDA DE DATOS
-- =====================================================
-- Este script implementa protecciones a nivel de BD
-- para IMPEDIR que se borren datos sin archivar
-- =====================================================

-- =====================================================
-- 1. CREAR TABLA DE AUDITORÍA PARA RASTREAR BORRADOS
-- =====================================================

CREATE TABLE IF NOT EXISTS model_values_deletion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL,
    platform_id TEXT NOT NULL,
    value DECIMAL NOT NULL,
    period_date DATE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_by TEXT, -- 'cron', 'manual', 'unknown'
    archived_first BOOLEAN DEFAULT FALSE,
    stack_trace TEXT,
    metadata JSONB
);

-- =====================================================
-- 2. TRIGGER: AUDITAR TODOS LOS BORRADOS
-- =====================================================

CREATE OR REPLACE FUNCTION audit_model_values_deletion()
RETURNS TRIGGER AS $$
DECLARE
    was_archived BOOLEAN;
BEGIN
    -- Verificar si este valor ya fue archivado
    SELECT EXISTS(
        SELECT 1 FROM calculator_history 
        WHERE model_id = OLD.model_id 
        AND platform_id = OLD.platform_id 
        AND period_date = OLD.period_date
    ) INTO was_archived;

    -- Registrar el borrado
    INSERT INTO model_values_deletion_log (
        model_id,
        platform_id,
        value,
        period_date,
        deleted_at,
        deleted_by,
        archived_first,
        metadata
    ) VALUES (
        OLD.model_id,
        OLD.platform_id,
        OLD.value,
        OLD.period_date,
        NOW(),
        current_setting('application_name', true), -- Captura quién lo borró
        was_archived,
        jsonb_build_object(
            'was_archived', was_archived,
            'warning', CASE WHEN NOT was_archived THEN 'DATA DELETED WITHOUT ARCHIVING!' ELSE null END
        )
    );

    -- Si NO estaba archivado, registrar ALERTA CRÍTICA
    IF NOT was_archived THEN
        RAISE WARNING '🚨 CRITICAL: Deleting model_values without archive! Model: %, Platform: %, Period: %', 
            OLD.model_id, OLD.platform_id, OLD.period_date;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS audit_model_values_deletion_trigger ON model_values;
CREATE TRIGGER audit_model_values_deletion_trigger
    BEFORE DELETE ON model_values
    FOR EACH ROW
    EXECUTE FUNCTION audit_model_values_deletion();

-- =====================================================
-- 3. FUNCIÓN: VALIDAR QUE EXISTE ARCHIVO ANTES DE BORRAR
-- =====================================================

CREATE OR REPLACE FUNCTION validate_archive_before_delete()
RETURNS TRIGGER AS $$
DECLARE
    archive_count INTEGER;
    bypass_validation BOOLEAN;
BEGIN
    -- Verificar si hay un flag de bypass (para operaciones administrativas autorizadas)
    bypass_validation := current_setting('myapp.bypass_archive_validation', true)::boolean;
    
    IF bypass_validation IS NULL THEN
        bypass_validation := FALSE;
    END IF;

    -- Si NO hay bypass, validar que exista archivo
    IF NOT bypass_validation THEN
        SELECT COUNT(*) INTO archive_count
        FROM calculator_history
        WHERE model_id = OLD.model_id
        AND platform_id = OLD.platform_id
        AND period_date = OLD.period_date;

        -- Si NO existe archivo, BLOQUEAR el borrado
        IF archive_count = 0 THEN
            RAISE EXCEPTION '🚨 PREVENTED DATA LOSS: Cannot delete model_values without archive! Model: %, Platform: %, Period: %. Archive first or set myapp.bypass_archive_validation = true.',
                OLD.model_id, OLD.platform_id, OLD.period_date;
        END IF;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger de validación (SE EJECUTA DESPUÉS DEL AUDIT)
DROP TRIGGER IF EXISTS validate_archive_before_delete_trigger ON model_values;
CREATE TRIGGER validate_archive_before_delete_trigger
    BEFORE DELETE ON model_values
    FOR EACH ROW
    EXECUTE FUNCTION validate_archive_before_delete();

-- =====================================================
-- 4. FUNCIÓN SEGURA: ATOMIC ARCHIVE AND DELETE
-- =====================================================

CREATE OR REPLACE FUNCTION safe_atomic_archive_and_delete(
    p_model_id UUID,
    p_period_date DATE,
    p_period_type TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_archived_count INTEGER := 0;
    v_deleted_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- Calcular rango del período
    IF p_period_type = '1-15' THEN
        v_start_date := date_trunc('month', p_period_date)::date;
        v_end_date := v_start_date + INTERVAL '14 days';
    ELSE
        v_start_date := date_trunc('month', p_period_date)::date + INTERVAL '15 days';
        v_end_date := (date_trunc('month', p_period_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
    END IF;

    -- PASO 1: ARCHIVAR (con RETURNING para contar)
    WITH archived AS (
        INSERT INTO calculator_history (
            model_id,
            platform_id,
            value,
            period_date,
            period_type,
            archived_at,
            value_usd_bruto,
            value_usd_modelo,
            value_cop_modelo,
            rate_eur_usd,
            rate_gbp_usd,
            rate_usd_cop,
            platform_percentage
        )
        SELECT 
            mv.model_id,
            mv.platform_id,
            mv.value,
            p_period_date, -- Normalizado
            p_period_type,
            NOW(),
            mv.value, -- Estos deberían calcularse, pero por ahora los ponemos como están
            mv.value,
            mv.value,
            NULL,
            NULL,
            NULL,
            NULL
        FROM model_values mv
        WHERE mv.model_id = p_model_id
        AND mv.period_date >= v_start_date
        AND mv.period_date <= v_end_date
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_archived_count FROM archived;

    -- VALIDACIÓN CRÍTICA: Si no se archivó nada, NO eliminar
    IF v_archived_count = 0 THEN
        -- Verificar si hay valores para archivar
        SELECT COUNT(*) INTO v_deleted_count
        FROM model_values
        WHERE model_id = p_model_id
        AND period_date >= v_start_date
        AND period_date <= v_end_date;

        IF v_deleted_count > 0 THEN
            RAISE EXCEPTION '🚨 ARCHIVE FAILED: Found % values but archived 0. ROLLBACK to prevent data loss!', v_deleted_count;
        ELSE
            -- No hay valores, es normal
            RETURN jsonb_build_object(
                'success', true,
                'archived', 0,
                'deleted', 0,
                'message', 'No values to archive (normal if period already closed)'
            );
        END IF;
    END IF;

    -- PASO 2: SOLO SI EL ARCHIVO FUE EXITOSO, ELIMINAR
    -- Activar bypass para esta operación autorizada
    PERFORM set_config('myapp.bypass_archive_validation', 'true', true);

    WITH deleted AS (
        DELETE FROM model_values
        WHERE model_id = p_model_id
        AND period_date >= v_start_date
        AND period_date <= v_end_date
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;

    -- Desactivar bypass
    PERFORM set_config('myapp.bypass_archive_validation', 'false', true);

    -- VALIDACIÓN FINAL: Archived debe ser >= Deleted
    IF v_archived_count < v_deleted_count THEN
        RAISE EXCEPTION '🚨 DATA LOSS DETECTED: Archived % but deleted %. ROLLBACK!', v_archived_count, v_deleted_count;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'archived', v_archived_count,
        'deleted', v_deleted_count,
        'period_start', v_start_date,
        'period_end', v_end_date
    );

EXCEPTION
    WHEN OTHERS THEN
        -- En caso de error, hacer ROLLBACK explícito
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'archived', v_archived_count,
            'deleted', v_deleted_count
        );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. VISTA: MONITOREAR BORRADOS SIN ARCHIVO
-- =====================================================

CREATE OR REPLACE VIEW dangerous_deletions AS
SELECT 
    dl.*,
    u.email as model_email,
    u.name as model_name
FROM model_values_deletion_log dl
LEFT JOIN users u ON dl.model_id = u.id
WHERE dl.archived_first = FALSE
ORDER BY dl.deleted_at DESC;

-- =====================================================
-- 6. FUNCIÓN: RECUPERAR DE LOG SI ES POSIBLE
-- =====================================================

CREATE OR REPLACE FUNCTION recover_from_deletion_log(
    p_period_date DATE,
    p_period_type TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_recovered_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- Insertar en calculator_history desde el log de borrados
    WITH recovered AS (
        INSERT INTO calculator_history (
            model_id,
            platform_id,
            value,
            period_date,
            period_type,
            archived_at,
            value_usd_bruto,
            value_usd_modelo,
            value_cop_modelo,
            metadata
        )
        SELECT 
            dl.model_id,
            dl.platform_id,
            dl.value,
            p_period_date,
            p_period_type,
            NOW(),
            dl.value, -- Valores sin calcular
            dl.value,
            dl.value,
            jsonb_build_object(
                'recovered_from_log', true,
                'original_deletion_date', dl.deleted_at,
                'warning', 'Recovered from deletion log - calculations may be incorrect'
            )
        FROM model_values_deletion_log dl
        WHERE dl.period_date = p_period_date
        AND dl.archived_first = FALSE
        AND NOT EXISTS (
            SELECT 1 FROM calculator_history ch
            WHERE ch.model_id = dl.model_id
            AND ch.platform_id = dl.platform_id
            AND ch.period_date = p_period_date
        )
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_recovered_count FROM recovered;

    RETURN jsonb_build_object(
        'success', true,
        'recovered_count', v_recovered_count,
        'message', format('Recovered %s records from deletion log', v_recovered_count)
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. COMENTARIOS Y PERMISOS
-- =====================================================

COMMENT ON TABLE model_values_deletion_log IS 'Auditoría de todos los borrados de model_values para prevenir pérdida de datos';
COMMENT ON FUNCTION safe_atomic_archive_and_delete IS 'Función segura que GARANTIZA archivo antes de borrar con validación triple';
COMMENT ON VIEW dangerous_deletions IS 'Vista para monitorear borrados peligrosos (sin archivo previo)';
COMMENT ON FUNCTION recover_from_deletion_log IS 'Recupera datos desde el log de borrados en caso de pérdida';

-- =====================================================
-- 8. ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_deletion_log_period ON model_values_deletion_log(period_date);
CREATE INDEX IF NOT EXISTS idx_deletion_log_model ON model_values_deletion_log(model_id);
CREATE INDEX IF NOT EXISTS idx_deletion_log_archived ON model_values_deletion_log(archived_first);

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

SELECT '✅ Sistema de protección contra pérdida de datos instalado' as status;
SELECT '✅ Triggers activos:' as info;
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'model_values';
