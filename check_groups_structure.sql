-- Verificar estructura de la columna groups en usuarios modelo
SELECT 
    id,
    name,
    email,
    role,
    is_active,
    groups,
    pg_typeof(groups) as groups_type
FROM users 
WHERE role = 'modelo' 
AND is_active = true
LIMIT 5;
