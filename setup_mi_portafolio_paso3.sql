-- =====================================================
-- PASO 3: CREAR VISTA Y POLÍTICAS RLS
-- =====================================================

-- Eliminar vista existente si existe
DROP VIEW IF EXISTS modelo_portfolio_view;

-- Crear nueva vista
CREATE VIEW modelo_portfolio_view AS
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

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Modelos pueden ver sus propias plataformas" ON modelo_plataformas;
DROP POLICY IF EXISTS "Modelos pueden confirmar sus plataformas" ON modelo_plataformas;
DROP POLICY IF EXISTS "Admins pueden ver todas las plataformas" ON modelo_plataformas;

-- Crear políticas RLS
CREATE POLICY "Modelos pueden ver sus propias plataformas" ON modelo_plataformas
    FOR SELECT USING (auth.uid() = model_id);

CREATE POLICY "Modelos pueden confirmar sus plataformas" ON modelo_plataformas
    FOR UPDATE USING (auth.uid() = model_id AND status = 'entregada');

CREATE POLICY "Admins pueden ver todas las plataformas" ON modelo_plataformas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
        )
    );

SELECT 'Paso 3 completado: Vista y políticas RLS creadas' as status;
