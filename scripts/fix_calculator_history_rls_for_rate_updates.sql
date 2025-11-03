-- 🔧 CORREGIR POLÍTICAS RLS PARA PERMITIR ACTUALIZACIÓN DE TASAS HISTÓRICAS
-- Este script permite que los admins y el service_role puedan actualizar registros históricos
-- específicamente para editar tasas de cierre de períodos
--
-- IMPORTANTE: El service_role DEBERÍA poder bypass RLS, pero si hay una política
-- con USING (false), puede estar bloqueando las actualizaciones incluso para service_role.
-- Este script elimina la política restrictiva y crea una permisiva.

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

-- 2. Eliminar política restrictiva de UPDATE (si existe)
DROP POLICY IF EXISTS "No updates to history" ON calculator_history;

-- 3. Crear política que permite a admins actualizar valores y tasas para correcciones
-- Esta política permite actualizaciones si el usuario es admin/super_admin O si es service_role
CREATE POLICY "Admins can update history for corrections" ON calculator_history
  FOR UPDATE 
  USING (
    -- Permitir si el usuario autenticado es admin o super_admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    -- Mismo check para WITH CHECK (requerido para UPDATE)
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- 4. Verificar que las políticas se crearon correctamente
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
WHERE tablename = 'calculator_history'
ORDER BY policyname;

-- NOTA: El service_role normalmente puede bypass RLS. Si después de ejecutar este script
-- aún no funciona, verificar que:
-- 1. El endpoint esté usando SUPABASE_SERVICE_ROLE_KEY (ya está configurado)
-- 2. La clave de servicio sea válida
-- 3. No haya otras políticas restrictivas

