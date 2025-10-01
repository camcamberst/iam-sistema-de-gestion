-- 🔧 SOLUCIÓN SISTÉMICA: PERMITIR ACCESO DEL ADMIN A CONFIGURACIONES

-- 1. Verificar políticas RLS actuales
SELECT 
  'current_policies' as tipo,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'calculator_config';

-- 2. Crear política para permitir acceso del admin
-- (Solo ejecutar si no existe)
INSERT INTO pg_policies (schemaname, tablename, policyname, permissive, roles, cmd, qual)
SELECT 
  'public',
  'calculator_config',
  'Admins can view all configs',
  'PERMISSIVE',
  ARRAY['admin', 'super_admin'],
  'SELECT',
  'EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN (''admin'', ''super_admin''))'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_policies 
  WHERE tablename = 'calculator_config' 
  AND policyname = 'Admins can view all configs'
);

-- 3. Verificar que la política se creó
SELECT 
  'updated_policies' as tipo,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'calculator_config';

-- 4. Verificar acceso del admin a configuraciones
-- (Esto se verifica en la consola del navegador)
SELECT 
  'admin_access_test' as tipo,
  'Verificar en consola del navegador si admin puede ver configuraciones' as instruccion;
