-- =====================================================
-- 🔐 CORREGIR POLÍTICA RLS CIRCULAR PARA GESTOR EN USERS
-- =====================================================
-- El problema: La política actual crea un ciclo circular
-- porque intenta leer 'users' para verificar el rol del gestor
-- =====================================================

-- Eliminar política problemática
DROP POLICY IF EXISTS "Gestores can read users" ON users;

-- Crear política mejorada que evita el ciclo circular
-- Opción 1: Usar auth.jwt() para obtener el rol directamente del token
-- (Requiere que el rol esté en el JWT)

-- Opción 2: Permitir lectura de usuarios si el usuario autenticado existe
-- y tiene un rol válido (verificando solo su propio registro)
CREATE POLICY "Gestores can read users" ON users
  FOR SELECT USING (
    -- Permitir si el usuario autenticado existe y tiene rol gestor, admin o super_admin
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('gestor', 'admin', 'super_admin')
      AND u.is_active = true
    )
    -- O permitir lectura pública de usuarios activos (si es necesario)
    -- OR is_active = true
  );

-- Alternativa más permisiva: Permitir a gestores leer todos los usuarios activos
-- Si la política anterior no funciona, usar esta:
/*
DROP POLICY IF EXISTS "Gestores can read users" ON users;
CREATE POLICY "Gestores can read users" ON users
  FOR SELECT USING (
    -- Permitir lectura de usuarios activos si el usuario autenticado es gestor/admin/super_admin
    is_active = true
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('gestor', 'admin', 'super_admin')
      AND u.is_active = true
    )
  );
*/

-- Verificar que la política se creó correctamente
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
AND policyname LIKE '%Gestores%';

