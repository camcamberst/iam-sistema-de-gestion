-- 🔍 OBTENER UUID REAL DE ELIZABETH
-- Ejecutar en Supabase SQL Editor

-- 1. Buscar Elizabeth por email (si conoces su email)
SELECT 
    'ELIZABETH POR EMAIL' as info,
    id,
    email,
    name,
    role
FROM auth.users 
WHERE email ILIKE '%elizabeth%' 
OR email ILIKE '%elizabeth@%'
ORDER BY created_at DESC;

-- 2. Buscar Elizabeth por nombre
SELECT 
    'ELIZABETH POR NOMBRE' as info,
    id,
    email,
    name,
    role
FROM auth.users 
WHERE name ILIKE '%elizabeth%'
ORDER BY created_at DESC;

-- 3. Buscar todos los usuarios para identificar a Elizabeth
SELECT 
    'TODOS LOS USUARIOS' as info,
    id,
    email,
    name,
    role,
    created_at
FROM auth.users 
ORDER BY created_at DESC
LIMIT 10;

-- 4. Buscar en la tabla users (si existe)
SELECT 
    'USUARIOS EN TABLA USERS' as info,
    id,
    email,
    name,
    role
FROM users 
WHERE name ILIKE '%elizabeth%'
OR email ILIKE '%elizabeth%'
ORDER BY created_at DESC;
