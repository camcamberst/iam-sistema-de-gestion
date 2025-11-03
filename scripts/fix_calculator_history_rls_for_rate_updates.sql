-- 🔧 CORREGIR POLÍTICAS RLS PARA PERMITIR ACTUALIZACIÓN DE TASAS HISTÓRICAS
-- Este script permite que los admins y el service_role puedan actualizar registros históricos
-- específicamente para editar tasas de cierre de períodos

-- 1. Eliminar política restrictiva de UPDATE (si existe)
DROP POLICY IF EXISTS "No updates to history" ON calculator_history;

-- 2. Crear política que permite a admins actualizar valores y tasas para correcciones
CREATE POLICY "Admins can update history for corrections" ON calculator_history
  FOR UPDATE 
  USING (
    -- Permitir si es service_role (bypass RLS para operaciones del sistema)
    auth.role() = 'service_role'
    OR
    -- Permitir si el usuario autenticado es admin o super_admin
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    -- Mismo check para WITH CHECK (requerido para UPDATE)
    auth.role() = 'service_role'
    OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- 3. También permitir que el service_role pueda actualizar directamente (por si acaso)
-- Nota: El service_role debería poder bypass RLS, pero esta política explícita ayuda

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
WHERE tablename = 'calculator_history'
ORDER BY policyname;

