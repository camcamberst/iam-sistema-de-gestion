-- =====================================================
-- 🚨 INSTALACIÓN SISTEMA DE PROTECCIÓN
-- =====================================================
-- Versión simplificada sin columnas que no existen
-- =====================================================

-- 1. Tabla de auditoría
CREATE TABLE IF NOT EXISTS model_values_deletion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL,
    platform_id TEXT NOT NULL,
    value DECIMAL NOT NULL,
    period_date DATE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_by TEXT,
    archived_first BOOLEAN DEFAULT FALSE
);

-- 2. Trigger de auditoría
CREATE OR REPLACE FUNCTION audit_model_values_deletion()
RETURNS TRIGGER AS $$
DECLARE
    was_archived BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM calculator_history 
        WHERE model_id = OLD.model_id 
        AND platform_id = OLD.platform_id 
        AND period_date = OLD.period_date
    ) INTO was_archived;

    INSERT INTO model_values_deletion_log (
        model_id,
        platform_id,
        value,
        period_date,
        archived_first
    ) VALUES (
        OLD.model_id,
        OLD.platform_id,
        OLD.value,
        OLD.period_date,
        was_archived
    );

    IF NOT was_archived THEN
        RAISE WARNING '🚨 DELETING WITHOUT ARCHIVE: Model %, Platform %, Period %', 
            OLD.model_id, OLD.platform_id, OLD.period_date;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_model_values_deletion_trigger ON model_values;
CREATE TRIGGER audit_model_values_deletion_trigger
    BEFORE DELETE ON model_values
    FOR EACH ROW
    EXECUTE FUNCTION audit_model_values_deletion();

-- 3. Vista de borrados peligrosos
CREATE OR REPLACE VIEW dangerous_deletions AS
SELECT 
    dl.*,
    u.email as model_email
FROM model_values_deletion_log dl
LEFT JOIN users u ON dl.model_id = u.id
WHERE dl.archived_first = FALSE
ORDER BY dl.deleted_at DESC;

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_deletion_log_period ON model_values_deletion_log(period_date);
CREATE INDEX IF NOT EXISTS idx_deletion_log_archived ON model_values_deletion_log(archived_first);

SELECT '✅ Sistema de protección instalado' as status;
