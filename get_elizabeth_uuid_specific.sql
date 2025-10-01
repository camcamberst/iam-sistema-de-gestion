-- 🔍 OBTENER UUID DE ELIZABETH (maiteflores@tuemailya.com)
-- Ejecutar en Supabase SQL Editor

-- 1. Buscar Elizabeth por email específico
SELECT 
    'ELIZABETH ESPECÍFICA' as info,
    id,
    email,
    name,
    role,
    created_at
FROM auth.users 
WHERE email = 'maiteflores@tuemailya.com';

-- 2. Si no se encuentra en auth.users, buscar en tabla users
SELECT 
    'ELIZABETH EN TABLA USERS' as info,
    id,
    email,
    name,
    role,
    created_at
FROM users 
WHERE email = 'maiteflores@tuemailya.com';

-- 3. Buscar por nombre si el email no funciona
SELECT 
    'ELIZABETH POR NOMBRE' as info,
    id,
    email,
    name,
    role,
    created_at
FROM auth.users 
WHERE name ILIKE '%elizabeth%'
OR name ILIKE '%maite%'
OR name ILIKE '%flores%'
ORDER BY created_at DESC;
