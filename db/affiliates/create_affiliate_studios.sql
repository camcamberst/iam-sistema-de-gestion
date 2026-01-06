-- =====================================================
-- 🏢 IMPLEMENTACIÓN: ESTUDIOS AFILIADOS
-- =====================================================
-- Fase 1: Base de Datos
-- Arquitectura: Columnas adicionales en tablas existentes
-- =====================================================

-- 1. CREAR TABLA PRINCIPAL: affiliate_studios
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  commission_percentage DECIMAL(5,2) DEFAULT 10.00, -- Porcentaje personalizable (10% por defecto)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL -- Superadmin que creó el estudio
);

-- Índice para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_affiliate_studios_name ON affiliate_studios(name);
CREATE INDEX IF NOT EXISTS idx_affiliate_studios_is_active ON affiliate_studios(is_active);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_affiliate_studios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_affiliate_studios_updated_at
  BEFORE UPDATE ON affiliate_studios
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_studios_updated_at();

-- =====================================================
-- 2. AGREGAR COLUMNA affiliate_studio_id A TABLAS EXISTENTES
-- =====================================================

-- 2.1. users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_affiliate_studio_id ON users(affiliate_studio_id);

-- 2.2. groups (tabla principal de sedes/grupos)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'groups') THEN
    ALTER TABLE groups 
    ADD COLUMN IF NOT EXISTS affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_groups_affiliate_studio_id ON groups(affiliate_studio_id);
  END IF;
END $$;

-- 2.3. sedes (si existe - puede que no esté en producción)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sedes') THEN
    ALTER TABLE sedes 
    ADD COLUMN IF NOT EXISTS affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_sedes_affiliate_studio_id ON sedes(affiliate_studio_id);
  END IF;
END $$;

-- 2.4. model_values
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'model_values') THEN
    ALTER TABLE model_values 
    ADD COLUMN IF NOT EXISTS affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_model_values_affiliate_studio_id ON model_values(affiliate_studio_id);
  END IF;
END $$;

-- 2.5. calculator_totals
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calculator_totals') THEN
    ALTER TABLE calculator_totals 
    ADD COLUMN IF NOT EXISTS affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_calculator_totals_affiliate_studio_id ON calculator_totals(affiliate_studio_id);
  END IF;
END $$;

-- 2.6. calculator_history
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calculator_history') THEN
    ALTER TABLE calculator_history 
    ADD COLUMN IF NOT EXISTS affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_calculator_history_affiliate_studio_id ON calculator_history(affiliate_studio_id);
  END IF;
END $$;

-- 2.7. calculator_config
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calculator_config') THEN
    ALTER TABLE calculator_config 
    ADD COLUMN IF NOT EXISTS affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_calculator_config_affiliate_studio_id ON calculator_config(affiliate_studio_id);
  END IF;
END $$;

-- 2.8. plataforma_requests
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plataforma_requests') THEN
    ALTER TABLE plataforma_requests 
    ADD COLUMN IF NOT EXISTS affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_plataforma_requests_affiliate_studio_id ON plataforma_requests(affiliate_studio_id);
  END IF;
END $$;

-- 2.9. anticipos
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'anticipos') THEN
    ALTER TABLE anticipos 
    ADD COLUMN IF NOT EXISTS affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_anticipos_affiliate_studio_id ON anticipos(affiliate_studio_id);
  END IF;
END $$;

-- 2.10. gestor_historical_rates (puede ser NULL para rates globales de Innova)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gestor_historical_rates') THEN
    ALTER TABLE gestor_historical_rates 
    ADD COLUMN IF NOT EXISTS affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_gestor_historical_rates_affiliate_studio_id ON gestor_historical_rates(affiliate_studio_id);
  END IF;
END $$;

-- =====================================================
-- 3. TABLA: affiliate_billing_summary
-- =====================================================
CREATE TABLE IF NOT EXISTS affiliate_billing_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_studio_id UUID NOT NULL REFERENCES affiliate_studios(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('P1', 'P2')),
  total_usd_bruto DECIMAL(12,2) DEFAULT 0,
  total_usd_affiliate DECIMAL(12,2) DEFAULT 0, -- Monto para el afiliado (90% o según acuerdo)
  total_usd_innova DECIMAL(12,2) DEFAULT 0, -- Comisión para Agencia Innova (10% o según acuerdo)
  total_cop_affiliate DECIMAL(12,2) DEFAULT 0,
  total_cop_innova DECIMAL(12,2) DEFAULT 0,
  models_count INTEGER DEFAULT 0,
  sedes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(affiliate_studio_id, period_date, period_type)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_billing_summary_studio_id ON affiliate_billing_summary(affiliate_studio_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_billing_summary_period ON affiliate_billing_summary(period_date, period_type);

-- Trigger para actualizar updated_at
CREATE TRIGGER trigger_update_affiliate_billing_summary_updated_at
  BEFORE UPDATE ON affiliate_billing_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_affiliate_studios_updated_at();

-- =====================================================
-- 4. COMENTARIOS Y DOCUMENTACIÓN
-- =====================================================
COMMENT ON TABLE affiliate_studios IS 'Estudios afiliados externos que operan dentro de su propia burbuja de datos';
COMMENT ON COLUMN affiliate_studios.commission_percentage IS 'Porcentaje de comisión que recibe Agencia Innova (por defecto 10%)';
COMMENT ON COLUMN affiliate_studios.created_by IS 'Superadmin de Agencia Innova que creó el estudio afiliado';

COMMENT ON TABLE affiliate_billing_summary IS 'Resumen de facturación por período para cada estudio afiliado';
COMMENT ON COLUMN affiliate_billing_summary.total_usd_innova IS 'Comisión que recibe Agencia Innova según commission_percentage del estudio';

-- =====================================================
-- 5. RLS (ROW LEVEL SECURITY) - Básico
-- =====================================================
-- Nota: Las políticas completas se implementarán en la Fase 2

ALTER TABLE affiliate_studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_billing_summary ENABLE ROW LEVEL SECURITY;

-- Política básica: Superadmins y admins pueden ver todos los estudios
CREATE POLICY "Superadmins and admins can view all affiliate studios" ON affiliate_studios
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Política básica: Superadmins pueden gestionar estudios
CREATE POLICY "Superadmins can manage affiliate studios" ON affiliate_studios
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Política básica: Superadmins y admins pueden ver facturación
CREATE POLICY "Superadmins and admins can view affiliate billing" ON affiliate_billing_summary
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- ✅ VERIFICACIÓN
-- =====================================================
-- Ejecutar para verificar que todo se creó correctamente:

-- SELECT 
--   'affiliate_studios' as tabla,
--   COUNT(*) as registros
-- FROM affiliate_studios
-- UNION ALL
-- SELECT 
--   'affiliate_billing_summary' as tabla,
--   COUNT(*) as registros
-- FROM affiliate_billing_summary;

