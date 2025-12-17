-- =====================================================
-- 📊 TABLA: gestor_historical_rates
-- =====================================================
-- Almacena rates históricas configuradas por el gestor
-- para recalcular valores en períodos históricos específicos
-- =====================================================
-- IMPORTANTE: Estas rates SOLO afectan a períodos históricos
-- NO afectan a rates actuales ni a períodos en curso
-- =====================================================

CREATE TABLE IF NOT EXISTS gestor_historical_rates (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id            uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    period_date         date NOT NULL,  -- Fecha de inicio del período (1 o 16 del mes)
    period_type         text NOT NULL CHECK (period_type IN ('1-15', '16-31')),
    
    -- Rates de cambio (igual estructura que rates actuales)
    rate_usd_cop        numeric(18,4) NOT NULL,  -- Tasa USD→COP
    rate_eur_usd        numeric(18,4) NOT NULL,   -- Tasa EUR→USD
    rate_gbp_usd        numeric(18,4) NOT NULL,   -- Tasa GBP→USD
    
    -- Metadatos
    configurado_por     uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,  -- Gestor/Admin que configuró
    aplicado_at         timestamptz,  -- Fecha cuando se aplicaron las rates (NULL = no aplicadas aún)
    aplicado_por        uuid REFERENCES users(id) ON DELETE SET NULL,  -- Usuario que aplicó las rates
    
    -- Auditoría
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    
    -- Constraint único: un grupo solo puede tener un set de rates por período
    UNIQUE(group_id, period_date, period_type)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_gestor_historical_rates_group_id ON gestor_historical_rates(group_id);
CREATE INDEX IF NOT EXISTS idx_gestor_historical_rates_period ON gestor_historical_rates(period_date, period_type);
CREATE INDEX IF NOT EXISTS idx_gestor_historical_rates_group_period ON gestor_historical_rates(group_id, period_date, period_type);
CREATE INDEX IF NOT EXISTS idx_gestor_historical_rates_configurado_por ON gestor_historical_rates(configurado_por);
CREATE INDEX IF NOT EXISTS idx_gestor_historical_rates_aplicado ON gestor_historical_rates(aplicado_at) WHERE aplicado_at IS NOT NULL;

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_gestor_historical_rates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_gestor_historical_rates_updated_at
    BEFORE UPDATE ON gestor_historical_rates
    FOR EACH ROW
    EXECUTE FUNCTION update_gestor_historical_rates_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE gestor_historical_rates IS 'Rates históricas configuradas por gestores para recalcular períodos históricos específicos. SOLO afectan a calculator_history, NO a rates actuales.';
COMMENT ON COLUMN gestor_historical_rates.group_id IS 'ID del grupo/sede al que aplican estas rates';
COMMENT ON COLUMN gestor_historical_rates.period_date IS 'Fecha de inicio del período (1 o 16 del mes)';
COMMENT ON COLUMN gestor_historical_rates.period_type IS 'Tipo de período: 1-15 o 16-31';
COMMENT ON COLUMN gestor_historical_rates.rate_usd_cop IS 'Tasa de cambio USD→COP para este período histórico';
COMMENT ON COLUMN gestor_historical_rates.rate_eur_usd IS 'Tasa de cambio EUR→USD para este período histórico';
COMMENT ON COLUMN gestor_historical_rates.rate_gbp_usd IS 'Tasa de cambio GBP→USD para este período histórico';
COMMENT ON COLUMN gestor_historical_rates.configurado_por IS 'ID del gestor/admin que configuró estas rates';
COMMENT ON COLUMN gestor_historical_rates.aplicado_at IS 'Fecha cuando se aplicaron las rates a calculator_history. NULL si aún no se han aplicado.';
COMMENT ON COLUMN gestor_historical_rates.aplicado_por IS 'ID del usuario que aplicó las rates a calculator_history';

-- RLS (Row Level Security)
ALTER TABLE gestor_historical_rates ENABLE ROW LEVEL SECURITY;

-- Usar función SECURITY DEFINER para evitar dependencias circulares
-- (Reutilizar la función existente si ya existe)
CREATE OR REPLACE FUNCTION public.is_user_gestor_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('gestor', 'admin', 'super_admin')
    AND is_active = true
  );
$$;

-- Política: Gestores, admins y super_admins pueden leer y escribir rates históricas
CREATE POLICY "Gestores and admins can manage historical rates" ON gestor_historical_rates
    FOR ALL
    USING (public.is_user_gestor_or_admin());

-- Política: Modelos pueden leer rates históricas (solo lectura)
CREATE POLICY "Modelos can read historical rates" ON gestor_historical_rates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'modelo'
            AND is_active = true
        )
    );

-- Recargar esquema
NOTIFY pgrst, 'reload schema';

