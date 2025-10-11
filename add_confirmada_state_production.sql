-- =====================================================
-- AGREGAR ESTADO 'CONFIRMADA' A MODELO_PLATAFORMAS
-- =====================================================
-- Script para producción - Ejecutar en Supabase
-- Permite que las modelos confirmen la recepción de plataformas entregadas
-- =====================================================

-- 1. Actualizar la constraint CHECK para incluir 'confirmada'
ALTER TABLE modelo_plataformas 
DROP CONSTRAINT IF EXISTS modelo_plataformas_status_check;

ALTER TABLE modelo_plataformas 
ADD CONSTRAINT modelo_plataformas_status_check 
CHECK (status IN ('disponible', 'solicitada', 'pendiente', 'entregada', 'confirmada', 'desactivada', 'inviable'));

-- 2. Agregar columna para timestamp de confirmación si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'modelo_plataformas' 
                   AND column_name = 'confirmed_at') THEN
        ALTER TABLE modelo_plataformas 
        ADD COLUMN confirmed_at TIMESTAMPTZ;
    END IF;
END $$;

-- 3. Agregar columna para usuario que confirmó si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'modelo_plataformas' 
                   AND column_name = 'confirmed_by') THEN
        ALTER TABLE modelo_plataformas 
        ADD COLUMN confirmed_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 4. Crear trigger para actualizar updated_at cuando cambie el estado
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

-- 5. Crear función para que la modelo confirme recepción
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

-- 6. Crear vista para que las modelos vean solo sus plataformas activas
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
LEFT JOIN auth.users u_confirmed ON mp.confirmed_by = u_confirmed.id
WHERE mp.status IN ('entregada', 'confirmada', 'desactivada')
ORDER BY mp.updated_at DESC;

-- 7. Habilitar RLS en la vista
ALTER VIEW modelo_portfolio_view SET (security_invoker = true);

-- 8. Crear política RLS para que las modelos solo vean sus propias plataformas
DROP POLICY IF EXISTS "Modelos solo pueden ver sus propias plataformas" ON modelo_plataformas;
CREATE POLICY "Modelos solo pueden ver sus propias plataformas" ON modelo_plataformas
    FOR SELECT
    USING (auth.uid() = model_id);

-- 9. Crear política RLS para que las modelos solo puedan confirmar sus propias plataformas
DROP POLICY IF EXISTS "Modelos solo pueden confirmar sus propias plataformas" ON modelo_plataformas;
CREATE POLICY "Modelos solo pueden confirmar sus propias plataformas" ON modelo_plataformas
    FOR UPDATE
    USING (auth.uid() = model_id AND status = 'entregada')
    WITH CHECK (auth.uid() = model_id AND status = 'confirmada');

-- 10. Verificar que los cambios se aplicaron correctamente
SELECT 
    'Estado confirmada agregado correctamente' as status,
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE table_name = 'modelo_plataformas' 
AND constraint_name = 'modelo_plataformas_status_check';

-- 11. Verificar que las columnas se agregaron
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'modelo_plataformas' 
AND column_name IN ('confirmed_at', 'confirmed_by')
ORDER BY column_name;
