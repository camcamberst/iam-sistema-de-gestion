-- =====================================================
-- 🔐 CORREGIR POLÍTICA RLS CIRCULAR PARA GESTOR EN USERS
-- =====================================================
-- Problema: La política actual crea un ciclo circular
-- Solución: Usar función de seguridad o política más permisiva
-- =====================================================

-- 1. Crear función helper para verificar rol del usuario autenticado
-- Esta función evita el ciclo circular usando SECURITY DEFINER
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

-- 2. Eliminar política problemática
DROP POLICY IF EXISTS "Gestores can read users" ON users;

-- 3. Crear nueva política usando la función helper
CREATE POLICY "Gestores can read users" ON users
  FOR SELECT USING (
    -- Permitir lectura de usuarios activos si el usuario autenticado es gestor/admin/super_admin
    is_active = true
    AND public.is_user_gestor_or_admin()
  );

-- 4. También corregir las otras políticas que tienen el mismo problema circular
DROP POLICY IF EXISTS "Gestores can read user_groups" ON user_groups;
CREATE POLICY "Gestores can read user_groups" ON user_groups
  FOR SELECT USING (
    public.is_user_gestor_or_admin()
  );

DROP POLICY IF EXISTS "Gestores can read groups" ON groups;
CREATE POLICY "Gestores can read groups" ON groups
  FOR SELECT USING (
    public.is_user_gestor_or_admin()
  );

-- 5. Verificar que las políticas se crearon correctamente
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('users', 'user_groups', 'groups')
AND policyname LIKE '%Gestores%'
ORDER BY tablename, policyname;

-- 6. Comentarios para documentación
COMMENT ON FUNCTION public.is_user_gestor_or_admin() IS 'Función helper para verificar si el usuario autenticado es gestor, admin o super_admin. Evita ciclos circulares en políticas RLS.';

