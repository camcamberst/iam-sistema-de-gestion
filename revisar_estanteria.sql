-- 🔍 REVISANDO LA "ESTANTERÍA" - ¿Qué hay realmente guardado?

-- 1. Ver la estructura de la tabla de usuarios (como ver el plano de la estantería)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- 2. Ver algunos usuarios modelo reales (como ver qué hay en los estantes)
SELECT 
    id,
    name,
    email,
    role,
    is_active,
    groups,
    pg_typeof(groups) as tipo_de_groups
FROM users 
WHERE role = 'modelo' 
LIMIT 3;

-- 3. Ver si hay alguna tabla de grupos (otra estantería)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%group%';

-- 4. Ver la tabla groups si existe
SELECT * FROM groups LIMIT 5;
