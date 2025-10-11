-- =====================================================
-- CREAR TABLA MODELO_PLATAFORMAS Y AGREGAR ESTADO 'CONFIRMADA'
-- =====================================================
-- Script completo para producción - Ejecutar en Supabase
-- Crea la tabla si no existe y agrega el estado 'confirmada'
-- =====================================================

-- 1. CREAR TABLA modelo_plataformas SI NO EXISTE
CREATE TABLE IF NOT EXISTS modelo_plataformas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL REFERENCES calculator_platforms(id) ON DELETE CASCADE,
  status VARCHAR(20) CHECK (status IN ('disponible', 'solicitada', 'pendiente', 'entregada', 'desactivada', 'inviable')) DEFAULT 'disponible',
  
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
  
  -- Constraints
  UNIQUE(model_id, platform_id)
);

-- 2. HABILITAR RLS
ALTER TABLE modelo_plataformas ENABLE ROW LEVEL SECURITY;

-- 3. CREAR ÍNDICES SI NO EXISTEN
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_model_id ON modelo_plataformas(model_id);
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_status ON modelo_plataformas(status);
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_platform_id ON modelo_plataformas(platform_id);

-- 4. ACTUALIZAR LA CONSTRAINT CHECK PARA INCLUIR 'confirmada'
ALTER TABLE modelo_plataformas 
DROP CONSTRAINT IF EXISTS modelo_plataformas_status_check;

ALTER TABLE modelo_plataformas 
ADD CONSTRAINT modelo_plataformas_status_check 
CHECK (status IN ('disponible', 'solicitada', 'pendiente', 'entregada', 'confirmada', 'desactivada', 'inviable'));

-- 5. CREAR TRIGGER PARA ACTUALIZAR updated_at
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

-- 6. CREAR FUNCIÓN PARA CONFIRMAR RECEPCIÓN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. CREAR VISTA PARA LAS MODELOS
CREATE OR REPLACE VIEW modelo_portfolio_view AS
SELECT 
    mp.id,
    mp.model_id,
    mp.platform_id,
    cp.name as platform_name,
    cp.id as platform_code,
    mp.status,
    mp.requested_at,
    mp.delivered_at,
    mp.confirmed_at,
    mp.deactivated_at,
    mp.reverted_at,
    mp.notes,
    mp.revert_reason,
    mp.is_initial_config,
    mp.calculator_sync,
    mp.calculator_activated_at,
    mp.created_at,
    mp.updated_at,
    -- Información del usuario que confirmó
    u_confirmed.name as confirmed_by_name,
    u_confirmed.email as confirmed_by_email
FROM modelo_plataformas mp
JOIN calculator_platforms cp ON mp.platform_id = cp.id
LEFT JOIN public.users u_confirmed ON mp.confirmed_by = u_confirmed.id
WHERE mp.status IN ('entregada', 'confirmada', 'desactivada')
ORDER BY mp.updated_at DESC;

-- 8. HABILITAR RLS EN LA VISTA
ALTER VIEW modelo_portfolio_view SET (security_invoker = true);

-- 9. CREAR POLÍTICAS RLS
DROP POLICY IF EXISTS "Modelos solo pueden ver sus propias plataformas" ON modelo_plataformas;
CREATE POLICY "Modelos solo pueden ver sus propias plataformas" ON modelo_plataformas
    FOR SELECT
    USING (auth.uid() = model_id);

DROP POLICY IF EXISTS "Modelos solo pueden confirmar sus propias plataformas" ON modelo_plataformas;
CREATE POLICY "Modelos solo pueden confirmar sus propias plataformas" ON modelo_plataformas
    FOR UPDATE
    USING (auth.uid() = model_id AND status = 'entregada')
    WITH CHECK (auth.uid() = model_id AND status = 'confirmada');

-- 10. POLÍTICAS PARA ADMINS
DROP POLICY IF EXISTS "Admins pueden gestionar plataformas de sus grupos" ON modelo_plataformas;
CREATE POLICY "Admins pueden gestionar plataformas de sus grupos" ON modelo_plataformas
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            JOIN public.user_groups ug ON u.id = ug.user_id
            JOIN public.user_groups ug2 ON ug.group_id = ug2.group_id
            WHERE u.id = auth.uid() 
            AND u.role IN ('admin', 'super_admin')
            AND ug2.user_id = modelo_plataformas.model_id
        )
    );

-- 11. VERIFICAR QUE TODO SE CREÓ CORRECTAMENTE
SELECT 
    'Tabla modelo_plataformas creada correctamente' as status,
    table_name
FROM information_schema.tables 
WHERE table_name = 'modelo_plataformas';

-- 12. VERIFICAR CONSTRAINT
SELECT 
    'Estado confirmada agregado correctamente' as status,
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE table_name = 'modelo_plataformas' 
AND constraint_name = 'modelo_plataformas_status_check';

-- 13. VERIFICAR COLUMNAS
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'modelo_plataformas' 
AND column_name IN ('confirmed_at', 'confirmed_by')
ORDER BY column_name;
