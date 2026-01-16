-- =====================================================
-- 🔧 FASE 1: CAMBIOS EN BASE DE DATOS
-- =====================================================
-- Nuevo sistema de cierre manual con datos persistentes
-- =====================================================

-- =====================================================
-- 1. AGREGAR CAMPOS A MODEL_VALUES
-- =====================================================

-- Agregar campos para control de archivado
ALTER TABLE model_values 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES users(id);

-- Comentarios para documentación
COMMENT ON COLUMN model_values.archived IS 'Indica si este valor ya fue archivado (no se elimina, solo se marca)';
COMMENT ON COLUMN model_values.archived_at IS 'Fecha y hora en que se archivó';
COMMENT ON COLUMN model_values.archived_by IS 'ID del admin que ejecutó el archivo (NULL si fue automático)';

-- =====================================================
-- 2. CREAR ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Índice para filtrar valores archivados vs activos
CREATE INDEX IF NOT EXISTS idx_model_values_archived 
ON model_values(archived) 
WHERE archived = FALSE;

-- Índice compuesto para consultas de períodos activos
CREATE INDEX IF NOT EXISTS idx_model_values_period_archived 
ON model_values(period_date, archived);

-- Índice para auditoría por admin
CREATE INDEX IF NOT EXISTS idx_model_values_archived_by 
ON model_values(archived_by) 
WHERE archived_by IS NOT NULL;

-- =====================================================
-- 3. CREAR TABLA DE LOG DE ARCHIVOS MANUALES
-- =====================================================

CREATE TABLE IF NOT EXISTS manual_archive_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_date DATE NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('1-15', '16-31')),
    archived_by UUID NOT NULL REFERENCES users(id),
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    records_archived INTEGER NOT NULL DEFAULT 0,
    records_in_history INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'regenerated', 'partial')),
    error_message TEXT,
    notes TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comentarios
COMMENT ON TABLE manual_archive_log IS 'Log de todas las operaciones de archivo manual de períodos';
COMMENT ON COLUMN manual_archive_log.records_archived IS 'Cantidad de registros marcados como archivados en model_values';
COMMENT ON COLUMN manual_archive_log.records_in_history IS 'Cantidad de registros creados en calculator_history';
COMMENT ON COLUMN manual_archive_log.status IS 'Estado del archivo: success (completo), failed (error), regenerated (rehecho), partial (parcial)';

-- Índices
CREATE INDEX idx_manual_archive_log_model ON manual_archive_log(model_id);
CREATE INDEX idx_manual_archive_log_period ON manual_archive_log(period_date, period_type);
CREATE INDEX idx_manual_archive_log_archived_by ON manual_archive_log(archived_by);
CREATE INDEX idx_manual_archive_log_status ON manual_archive_log(status);
CREATE INDEX idx_manual_archive_log_date ON manual_archive_log(archived_at);

-- =====================================================
-- 4. MARCAR P1 ENERO 2026 COMO ARCHIVADO
-- =====================================================

-- Marcar los valores del P1 que ya existen como archivados
-- (para que no se muestren en "Mi Calculadora" pero persistan en BD)
UPDATE model_values 
SET 
    archived = TRUE,
    archived_at = '2026-01-16 00:00:00+00',
    archived_by = NULL  -- NULL = sistema/automático
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-15'
  AND archived = FALSE;

-- Registrar esta operación en el log
INSERT INTO manual_archive_log (
    model_id,
    period_date,
    period_type,
    archived_by,
    archived_at,
    records_archived,
    records_in_history,
    status,
    notes,
    metadata
)
SELECT 
    model_id,
    '2026-01-01' as period_date,
    '1-15' as period_type,
    NULL as archived_by,  -- Sistema
    '2026-01-16 00:00:00+00' as archived_at,
    COUNT(*) as records_archived,
    (
        SELECT COUNT(*) 
        FROM calculator_history ch 
        WHERE ch.model_id = mv.model_id 
        AND ch.period_date = '2026-01-01' 
        AND ch.period_type = '1-15'
    ) as records_in_history,
    'success' as status,
    'Marcado como archivado retroactivamente durante migración al nuevo sistema' as notes,
    jsonb_build_object(
        'migration', true,
        'system', 'automatic',
        'reason', 'Consolidado ya existía en calculator_history'
    ) as metadata
FROM model_values mv
WHERE mv.period_date >= '2026-01-01' 
  AND mv.period_date <= '2026-01-15'
  AND mv.archived = TRUE
GROUP BY mv.model_id;

-- =====================================================
-- 5. CREAR VISTA PARA MONITOREO
-- =====================================================

CREATE OR REPLACE VIEW v_period_archive_status AS
SELECT 
    mv.period_date,
    CASE 
        WHEN EXTRACT(DAY FROM mv.period_date) <= 15 THEN '1-15'
        ELSE '16-31'
    END as period_type,
    COUNT(DISTINCT mv.model_id) as total_models,
    COUNT(DISTINCT CASE WHEN mv.archived THEN mv.model_id END) as archived_models,
    COUNT(DISTINCT CASE WHEN NOT mv.archived THEN mv.model_id END) as pending_models,
    COUNT(*) as total_records,
    SUM(CASE WHEN mv.archived THEN 1 ELSE 0 END) as archived_records,
    SUM(CASE WHEN NOT mv.archived THEN 1 ELSE 0 END) as pending_records,
    MIN(mv.archived_at) FILTER (WHERE mv.archived) as first_archive,
    MAX(mv.archived_at) FILTER (WHERE mv.archived) as last_archive,
    COUNT(DISTINCT mv.archived_by) FILTER (WHERE mv.archived_by IS NOT NULL) as unique_archivers
FROM model_values mv
GROUP BY mv.period_date
ORDER BY mv.period_date DESC;

COMMENT ON VIEW v_period_archive_status IS 'Vista resumen del estado de archivo de cada período';

-- =====================================================
-- 6. FUNCIÓN AUXILIAR: OBTENER ESTADO DE UN PERÍODO
-- =====================================================

CREATE OR REPLACE FUNCTION get_period_archive_status(
    p_period_date DATE,
    p_period_type TEXT
)
RETURNS TABLE (
    total_models BIGINT,
    archived_models BIGINT,
    pending_models BIGINT,
    total_records BIGINT,
    archived_records BIGINT,
    pending_records BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT model_id)::BIGINT as total_models,
        COUNT(DISTINCT CASE WHEN archived THEN model_id END)::BIGINT as archived_models,
        COUNT(DISTINCT CASE WHEN NOT archived THEN model_id END)::BIGINT as pending_models,
        COUNT(*)::BIGINT as total_records,
        SUM(CASE WHEN archived THEN 1 ELSE 0 END)::BIGINT as archived_records,
        SUM(CASE WHEN NOT archived THEN 1 ELSE 0 END)::BIGINT as pending_records
    FROM model_values
    WHERE period_date >= (
        CASE 
            WHEN p_period_type = '1-15' THEN p_period_date
            ELSE p_period_date
        END
    )
    AND period_date <= (
        CASE 
            WHEN p_period_type = '1-15' THEN DATE(date_trunc('month', p_period_date) + INTERVAL '14 days')
            ELSE DATE(date_trunc('month', p_period_date) + INTERVAL '1 month' - INTERVAL '1 day')
        END
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_period_archive_status IS 'Obtiene el estado de archivo de un período específico';

-- =====================================================
-- 7. VERIFICACIÓN DE LA INSTALACIÓN
-- =====================================================

-- Verificar que los campos se agregaron
SELECT 
    'VERIFICACIÓN: Campos en model_values' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'model_values' 
            AND column_name IN ('archived', 'archived_at', 'archived_by')
            HAVING COUNT(*) = 3
        ) 
        THEN '✅ OK: Campos agregados correctamente'
        ELSE '❌ ERROR: Faltan campos'
    END as result;

-- Verificar que la tabla de log existe
SELECT 
    'VERIFICACIÓN: Tabla manual_archive_log' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'manual_archive_log'
        ) 
        THEN '✅ OK: Tabla creada'
        ELSE '❌ ERROR: Tabla no existe'
    END as result;

-- Verificar que la vista existe
SELECT 
    'VERIFICACIÓN: Vista v_period_archive_status' as check_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_name = 'v_period_archive_status'
        ) 
        THEN '✅ OK: Vista creada'
        ELSE '❌ ERROR: Vista no existe'
    END as result;

-- Ver estado del P1 enero 2026
SELECT 
    'VERIFICACIÓN: P1 Enero 2026 marcado' as check_name,
    COUNT(*) as registros_marcados,
    COUNT(DISTINCT model_id) as modelos_afectados,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ OK: P1 marcado como archivado'
        ELSE '⚠️ No había datos para marcar (normal si estaban borrados)'
    END as result
FROM model_values
WHERE period_date >= '2026-01-01'
  AND period_date <= '2026-01-15'
  AND archived = TRUE;

-- =====================================================
-- 8. ROLLBACK DE LA TRANSACCIÓN PENDIENTE (SI EXISTE)
-- =====================================================

-- Si tienes una transacción pendiente del DELETE anterior, cancelarla:
-- ROLLBACK;

SELECT '✅ FASE 1 COMPLETADA - Nuevo sistema de cierre instalado' as status;
