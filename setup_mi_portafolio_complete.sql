-- =====================================================
-- SETUP COMPLETO DE "MI PORTAFOLIO" - PRODUCCIÓN
-- =====================================================
-- Script completo para configurar toda la funcionalidad de Mi Portafolio
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. CREAR TABLA modelo_plataformas SI NO EXISTE
CREATE TABLE IF NOT EXISTS modelo_plataformas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL REFERENCES calculator_platforms(id) ON DELETE CASCADE,
  status VARCHAR(20) CHECK (status IN ('disponible', 'solicitada', 'pendiente', 'entregada', 'confirmada', 'desactivada', 'inviable')) DEFAULT 'disponible',
  
  -- Timestamps del flujo
  requested_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  reverted_at TIMESTAMPTZ,
  
  -- Referencias de usuarios
  requested_by UUID REFERENCES auth.users(id),
  delivered_by UUID REFERENCES auth.users(id),
  confirmed_by UUID REFERENCES auth.users(id),
  deactivated_by UUID REFERENCES auth.users(id),
  reverted_by UUID REFERENCES auth.users(id),
  
  -- Metadatos
  notes TEXT,
  revert_reason TEXT,
  is_initial_config BOOLEAN DEFAULT false,
  calculator_sync BOOLEAN DEFAULT false,
  calculator_activated_at TIMESTAMPTZ,
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(model_id, platform_id)
);

-- 2. HABILITAR RLS
ALTER TABLE modelo_plataformas ENABLE ROW LEVEL SECURITY;

-- 3. CREAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_model_id ON modelo_plataformas(model_id);
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_status ON modelo_plataformas(status);
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_platform_id ON modelo_plataformas(platform_id);

-- 4. CREAR TRIGGER PARA updated_at
CREATE OR REPLACE FUNCTION update_modelo_plataformas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_modelo_plataformas_updated_at ON modelo_plataformas;
CREATE TRIGGER trigger_update_modelo_plataformas_updated_at
    BEFORE UPDATE ON modelo_plataformas
    FOR EACH ROW
    EXECUTE FUNCTION update_modelo_plataformas_updated_at();

-- 5. CREAR FUNCIÓN PARA CONFIRMAR ENTREGA
CREATE OR REPLACE FUNCTION confirm_platform_delivery(
    p_model_id UUID,
    p_platform_id TEXT,
    p_confirmed_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    current_status TEXT;
BEGIN
    -- Verificar que la plataforma existe y está en estado 'entregada'
    SELECT status INTO current_status
    FROM modelo_plataformas
    WHERE model_id = p_model_id 
    AND platform_id = p_platform_id;
    
    -- Verificar que el usuario que confirma es el modelo propietario
    IF p_model_id != p_confirmed_by THEN
        RAISE EXCEPTION 'Solo el modelo propietario puede confirmar la recepción';
    END IF;
    
    -- Verificar que está en estado 'entregada'
    IF current_status != 'entregada' THEN
        RAISE EXCEPTION 'Solo se pueden confirmar plataformas en estado entregada';
    END IF;
    
    -- Actualizar a estado 'confirmada'
    UPDATE modelo_plataformas
    SET 
        status = 'confirmada',
        confirmed_at = now(),
        confirmed_by = p_confirmed_by,
        updated_at = now()
    WHERE model_id = p_model_id 
    AND platform_id = p_platform_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 6. CREAR VISTA PARA PORTAFOLIO DE MODELO
CREATE OR REPLACE VIEW modelo_portfolio_view AS
SELECT 
    mp.id,
    mp.model_id,
    mp.platform_id,
    cp.name as platform_name,
    cp.currency,
    mp.status,
    mp.requested_at,
    mp.delivered_at,
    mp.confirmed_at,
    mp.deactivated_at,
    mp.notes,
    mp.is_initial_config,
    mp.calculator_sync,
    mp.calculator_activated_at,
    mp.created_at,
    mp.updated_at,
    -- Información de usuarios
    u_requested.name as requested_by_name,
    u_delivered.name as delivered_by_name,
    u_confirmed.name as confirmed_by_name,
    u_deactivated.name as deactivated_by_name
FROM modelo_plataformas mp
LEFT JOIN calculator_platforms cp ON mp.platform_id = cp.id
LEFT JOIN public.users u_requested ON mp.requested_by = u_requested.id
LEFT JOIN public.users u_delivered ON mp.delivered_by = u_delivered.id
LEFT JOIN public.users u_confirmed ON mp.confirmed_by = u_confirmed.id
LEFT JOIN public.users u_deactivated ON mp.deactivated_by = u_deactivated.id;

-- 7. CREAR POLÍTICAS RLS
-- Política para que las modelos vean solo sus propias plataformas
DROP POLICY IF EXISTS "Modelos pueden ver sus propias plataformas" ON modelo_plataformas;
CREATE POLICY "Modelos pueden ver sus propias plataformas" ON modelo_plataformas
    FOR SELECT USING (auth.uid() = model_id);

-- Política para que las modelos puedan confirmar sus plataformas
DROP POLICY IF EXISTS "Modelos pueden confirmar sus plataformas" ON modelo_plataformas;
CREATE POLICY "Modelos pueden confirmar sus plataformas" ON modelo_plataformas
    FOR UPDATE USING (auth.uid() = model_id AND status = 'entregada');

-- Política para admins (ver todas las plataformas de sus grupos)
DROP POLICY IF EXISTS "Admins pueden ver plataformas de sus grupos" ON modelo_plataformas;
CREATE POLICY "Admins pueden ver plataformas de sus grupos" ON modelo_plataformas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_groups ug
            JOIN groups g ON ug.group_id = g.id
            JOIN user_groups model_groups ON model_groups.group_id = g.id
            WHERE ug.user_id = auth.uid()
            AND model_groups.user_id = model_id
        )
    );

-- Política para super admins (ver todo)
DROP POLICY IF EXISTS "Super admins pueden ver todo" ON modelo_plataformas;
CREATE POLICY "Super admins pueden ver todo" ON modelo_plataformas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- 8. HABILITAR RLS EN LA VISTA
ALTER VIEW modelo_portfolio_view SET (security_invoker = true);

-- 9. INSERTAR DATOS DE PRUEBA (OPCIONAL)
-- Solo ejecutar si quieres datos de prueba
/*
INSERT INTO modelo_plataformas (model_id, platform_id, status, is_initial_config, calculator_sync)
SELECT 
    u.id as model_id,
    cp.id as platform_id,
    'confirmada' as status,
    true as is_initial_config,
    true as calculator_sync
FROM public.users u
CROSS JOIN calculator_platforms cp
WHERE u.role = 'modelo'
AND cp.is_active = true
ON CONFLICT (model_id, platform_id) DO NOTHING;
*/

-- 10. VERIFICACIÓN FINAL
SELECT 
    'Tabla modelo_plataformas creada' as status,
    COUNT(*) as total_records
FROM modelo_plataformas;

SELECT 
    'Vista modelo_portfolio_view creada' as status,
    COUNT(*) as total_records
FROM modelo_portfolio_view;

SELECT 
    'Función confirm_platform_delivery creada' as status,
    routine_name
FROM information_schema.routines
WHERE routine_name = 'confirm_platform_delivery'
AND routine_schema = 'public';

-- =====================================================
-- FIN DEL SETUP
-- =====================================================
-- Después de ejecutar este script, "Mi Portafolio" debería funcionar correctamente
-- =====================================================
