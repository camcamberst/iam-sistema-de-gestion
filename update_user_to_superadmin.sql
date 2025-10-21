-- Script para cambiar el rol del usuario camcamberst@gmail.com a super_admin
-- Esto permitirá probar correctamente la funcionalidad del panel superadmin

UPDATE users 
SET role = 'super_admin' 
WHERE email = 'camcamberst@gmail.com';

-- Verificar el cambio
SELECT id, name, email, role, is_active 
FROM users 
WHERE email = 'camcamberst@gmail.com';
