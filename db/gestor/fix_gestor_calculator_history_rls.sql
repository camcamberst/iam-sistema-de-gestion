-- =====================================================
-- 🔐 CORREGIR PERMISOS RLS PARA GESTOR EN calculator_history
-- =====================================================
-- Asegurar que el gestor pueda leer calculator_history
-- para cargar rates históricas en la página de Stats
-- =====================================================

-- 1. Verificar políticas existentes
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'calculator_history'
ORDER BY policyname;

-- 2. Crear política para gestores: pueden leer calculator_history
-- Usar función SECURITY DEFINER existente para evitar dependencias circulares
-- Reutilizar is_user_gestor_or_admin() que ya existe en otros scripts

-- Asegurar que la función existe (reutilizar la de otros scripts)
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

-- También crear función específica para gestor (por si se necesita)
CREATE OR REPLACE FUNCTION public.is_user_gestor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'gestor'
    AND is_active = true
  );
$$;

-- Eliminar política existente si existe
DROP POLICY IF EXISTS "Gestores can read calculator_history" ON calculator_history;

-- Crear política: Gestores pueden leer calculator_history
-- Usar is_user_gestor() para que solo gestores puedan leer (no admins desde esta política)
CREATE POLICY "Gestores can read calculator_history" ON calculator_history
  FOR SELECT 
  USING (public.is_user_gestor());

-- 3. Verificar que las políticas se crearon correctamente
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'calculator_history'
ORDER BY policyname;

-- Recargar esquema para PostgREST
NOTIFY pgrst, 'reload schema';

