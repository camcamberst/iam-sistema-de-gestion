-- Verificar si la tabla groups existe
SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'groups'
) as table_exists;

-- Verificar estructura de la tabla groups
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'groups'
ORDER BY ordinal_position;

-- Verificar políticas RLS en la tabla groups
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
WHERE tablename = 'groups';

-- Verificar si RLS está habilitado en la tabla groups
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'groups';

-- Verificar datos en la tabla groups
SELECT COUNT(*) as total_groups FROM groups;

-- Mostrar algunos grupos de ejemplo
SELECT id, name, is_manager, created_at 
FROM groups 
LIMIT 5;
