-- =============================================================
-- 🔐 SEGURIDAD FASE 2: CONTROL DE ACCESO A LOGS Y VISTAS CRÍTICAS
-- Ecosistema: Aurora (iam-gestion)
-- Objetivo: Blindar logs de eliminaciones y asegurar las 5 vistas
-- =============================================================

-- 1. TABLA: model_values_deletion_log (Logs de eliminación)
-- -------------------------------------------------------------
-- Habilitar RLS en la tabla física de logs de borrado
ALTER TABLE IF EXISTS public.model_values_deletion_log ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas previas para evitar conflictos
DROP POLICY IF EXISTS "Admins can manage deletion logs" ON public.model_values_deletion_log;

-- Políticas: Acceso exclusivo para administradores
CREATE POLICY "Admins can manage deletion logs" ON public.model_values_deletion_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- 2. VISTAS: Asegurar configurando SECURITY INVOKER = TRUE
-- -------------------------------------------------------------
-- Esto obliga a las vistas a validar las políticas RLS del usuario que las consulta.
ALTER VIEW IF EXISTS public.room_assignments_detailed SET (security_invoker = true);
ALTER VIEW IF EXISTS public.modelo_plataformas_detailed SET (security_invoker = true);
ALTER VIEW IF EXISTS public.modelo_portfolio_view SET (security_invoker = true);
ALTER VIEW IF EXISTS public.dangerous_deletions SET (security_invoker = true);
ALTER VIEW IF EXISTS public.period_closure_status SET (security_invoker = true);
