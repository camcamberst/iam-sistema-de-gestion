-- =====================================================
-- PASO 2: CREAR FUNCIÓN Y TRIGGER
-- =====================================================

-- Crear trigger para updated_at
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

-- Crear función para confirmar entrega
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

SELECT 'Paso 2 completado: Función y trigger creados' as status;
