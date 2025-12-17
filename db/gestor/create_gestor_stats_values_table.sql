-- =====================================================
-- 📊 TABLA: gestor_stats_values
-- =====================================================
-- Almacena los valores oficiales en bruto ingresados por el gestor
-- para cada modelo, plataforma y período
-- =====================================================

CREATE TABLE IF NOT EXISTS gestor_stats_values (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id            uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    platform_id         text NOT NULL REFERENCES calculator_platforms(id) ON DELETE CASCADE,
    period_date         date NOT NULL,  -- Fecha de inicio del período (1 o 16)
    period_type         text NOT NULL CHECK (period_type IN ('1-15', '16-31')),
    value               numeric(12,2) NOT NULL DEFAULT 0,  -- Valor en bruto (en la moneda de la plataforma)
    registrado_por      uuid REFERENCES users(id) ON DELETE SET NULL,  -- ID del gestor que registró
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    
    -- Constraint único: un modelo solo puede tener un valor por plataforma y período
    UNIQUE(model_id, platform_id, period_date, period_type)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_gestor_stats_values_model_id ON gestor_stats_values(model_id);
CREATE INDEX IF NOT EXISTS idx_gestor_stats_values_group_id ON gestor_stats_values(group_id);
CREATE INDEX IF NOT EXISTS idx_gestor_stats_values_platform_id ON gestor_stats_values(platform_id);
CREATE INDEX IF NOT EXISTS idx_gestor_stats_values_period ON gestor_stats_values(period_date, period_type);
CREATE INDEX IF NOT EXISTS idx_gestor_stats_values_group_period ON gestor_stats_values(group_id, period_date, period_type);
CREATE INDEX IF NOT EXISTS idx_gestor_stats_values_registrado_por ON gestor_stats_values(registrado_por) WHERE registrado_por IS NOT NULL;

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_gestor_stats_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_gestor_stats_values_updated_at
    BEFORE UPDATE ON gestor_stats_values
    FOR EACH ROW
    EXECUTE FUNCTION update_gestor_stats_values_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE gestor_stats_values IS 'Valores oficiales en bruto ingresados por el gestor para cada modelo, plataforma y período';
COMMENT ON COLUMN gestor_stats_values.model_id IS 'ID del modelo';
COMMENT ON COLUMN gestor_stats_values.group_id IS 'ID del grupo/sede al que pertenece el modelo';
COMMENT ON COLUMN gestor_stats_values.platform_id IS 'ID de la plataforma';
COMMENT ON COLUMN gestor_stats_values.period_date IS 'Fecha de inicio del período (1 o 16 del mes)';
COMMENT ON COLUMN gestor_stats_values.period_type IS 'Tipo de período: 1-15 o 16-31';
COMMENT ON COLUMN gestor_stats_values.value IS 'Valor oficial en bruto ingresado por el gestor (en la moneda de la plataforma)';
COMMENT ON COLUMN gestor_stats_values.registrado_por IS 'ID del gestor que registró este valor';

-- RLS (Row Level Security)
ALTER TABLE gestor_stats_values ENABLE ROW LEVEL SECURITY;

-- Política: Gestores pueden leer y escribir sus propios registros
CREATE POLICY "Gestores can manage gestor_stats_values" ON gestor_stats_values
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'gestor'
        )
    );

-- Política: Admins y super_admins pueden leer y escribir todos los registros
CREATE POLICY "Admins can manage all gestor_stats_values" ON gestor_stats_values
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'super_admin')
        )
    );

-- Política: Modelos pueden leer sus propios registros (solo lectura)
CREATE POLICY "Modelos can read own gestor_stats_values" ON gestor_stats_values
    FOR SELECT
    USING (
        model_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role = 'modelo'
        )
    );

