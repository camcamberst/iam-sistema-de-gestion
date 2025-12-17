-- =====================================================
-- CORREGIR POLÍTICAS RLS DE gestor_stats_values
-- =====================================================
-- Problema: Las políticas RLS consultan la tabla users
-- dentro de la política, causando errores 406
-- Solución: Usar función SECURITY DEFINER para romper
-- la dependencia circular
-- =====================================================

-- Crear función helper para verificar si el usuario es gestor o admin
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

-- Eliminar políticas existentes
DROP POLICY IF EXISTS "Gestores can manage gestor_stats_values" ON gestor_stats_values;
DROP POLICY IF EXISTS "Admins can manage all gestor_stats_values" ON gestor_stats_values;
DROP POLICY IF EXISTS "Modelos can read own gestor_stats_values" ON gestor_stats_values;

-- Política: Gestores, admins y super_admins pueden leer y escribir todos los registros
CREATE POLICY "Gestores and admins can manage gestor_stats_values" ON gestor_stats_values
    FOR ALL
    USING (
        public.is_user_gestor_or_admin()
    );

-- Política: Modelos pueden leer sus propios registros (solo lectura)
CREATE POLICY "Modelos can read own gestor_stats_values" ON gestor_stats_values
    FOR SELECT
    USING (
        model_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND role = 'modelo'
            AND is_active = true
        )
    );

-- Comentarios
COMMENT ON FUNCTION public.is_user_gestor_or_admin() IS 'Verifica si el usuario actual es gestor, admin o super_admin usando SECURITY DEFINER para evitar dependencias circulares';

