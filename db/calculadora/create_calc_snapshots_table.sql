-- =====================================================
-- 🔄 CREAR TABLA calc_snapshots PARA BACKUP DE SEGURIDAD
-- =====================================================
-- Esta tabla almacena snapshots completos antes del archivado
-- para permitir recuperación en caso de fallo
-- =====================================================

CREATE TABLE IF NOT EXISTS calc_snapshots (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_id           uuid NOT NULL,
    totals_json         jsonb NOT NULL,
    rates_applied_json  jsonb NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Índice único para evitar duplicados por modelo y período
CREATE UNIQUE INDEX IF NOT EXISTS calc_snapshots_unique ON calc_snapshots (model_id, period_id);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_calc_snapshots_model_id ON calc_snapshots(model_id);
CREATE INDEX IF NOT EXISTS idx_calc_snapshots_created_at ON calc_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calc_snapshots_period_id ON calc_snapshots(period_id);

-- Comentarios para documentación
COMMENT ON TABLE calc_snapshots IS 'Snapshots de seguridad antes del archivado de períodos';
COMMENT ON COLUMN calc_snapshots.model_id IS 'ID del modelo';
COMMENT ON COLUMN calc_snapshots.period_id IS 'UUID determinístico generado desde period_date + period_type + model_id';
COMMENT ON COLUMN calc_snapshots.totals_json IS 'JSON con todos los valores del período, fechas, y metadatos';
COMMENT ON COLUMN calc_snapshots.rates_applied_json IS 'JSON con tasas activas y configuración del modelo al momento del backup';

