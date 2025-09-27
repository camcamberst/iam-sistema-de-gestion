-- =====================================================
-- 👑 CREAR SUPER ADMIN - SCRIPT DE INICIALIZACIÓN
-- =====================================================
-- Este script crea el Super Admin inicial del sistema
-- =====================================================

-- 1. 🧹 LIMPIAR DATOS EXISTENTES (OPCIONAL - DESCOMENTAR SI NECESARIO)
-- DELETE FROM user_groups WHERE user_id IN (SELECT id FROM users WHERE role = 'super_admin');
-- DELETE FROM users WHERE role = 'super_admin';
-- DELETE FROM auth.users WHERE email = 'superadmin@example.com';

-- 2. 👑 CREAR SUPER ADMIN EN AUTH.USERS
-- =====================================================
-- NOTA: Este paso debe hacerse manualmente en Supabase Auth
-- Ir a Authentication > Users > Add User
-- Email: superadmin@example.com
-- Password: 123456
-- Confirm: true

-- 3. 🔗 CREAR PERFIL EN PUBLIC.USERS
-- =====================================================
-- Este script asume que el usuario ya existe en auth.users
-- Si no existe, crear primero en Supabase Auth

INSERT INTO users (
  id,
  organization_id,
  name,
  role,
  is_active,
  last_login,
  metadata
) VALUES (
  -- IMPORTANTE: Reemplazar con el ID real del usuario de auth.users
  (SELECT id FROM auth.users WHERE email = 'superadmin@example.com' LIMIT 1),
  '00000000-0000-0000-0000-000000000001', -- Organización principal
  'Super Administrador',
  'super_admin',
  true,
  now(),
  '{"created_by": "system", "is_initial": true}'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  role = 'super_admin',
  is_active = true,
  updated_at = now();

-- 4. 🏢 ASIGNAR A TODOS LOS GRUPOS (Super Admin tiene acceso total)
-- =====================================================
INSERT INTO user_groups (user_id, group_id, is_manager)
SELECT 
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1),
  g.id,
  true -- Super Admin es manager de todos los grupos
FROM groups g
WHERE g.organization_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (user_id, group_id) DO UPDATE SET
  is_manager = true,
  assigned_at = now();

-- 5. 📊 CREAR LOG DE AUDITORÍA
-- =====================================================
INSERT INTO audit_logs (
  organization_id,
  user_id,
  action,
  resource_type,
  resource_id,
  details
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1),
  'user.create',
  'user',
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1),
  '{"role": "super_admin", "created_by": "system"}'::jsonb
);

-- 6. ✅ VERIFICACIÓN
-- =====================================================
-- Verificar que el Super Admin fue creado correctamente
SELECT 
  u.id,
  u.name,
  u.role,
  u.is_active,
  o.name as organization,
  COUNT(ug.group_id) as groups_assigned
FROM users u
JOIN organizations o ON u.organization_id = o.id
LEFT JOIN user_groups ug ON u.id = ug.user_id
WHERE u.role = 'super_admin'
GROUP BY u.id, u.name, u.role, u.is_active, o.name;

-- =====================================================
-- 🎯 INSTRUCCIONES PARA EJECUTAR:
-- =====================================================
-- 1. Ir a Supabase > Authentication > Users
-- 2. Click "Add User"
-- 3. Email: superadmin@example.com
-- 4. Password: 123456
-- 5. Confirm: true
-- 6. Ejecutar este script en SQL Editor
-- 7. Verificar que el usuario aparece en la tabla users
-- =====================================================
