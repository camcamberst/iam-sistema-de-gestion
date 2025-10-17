-- Script para eliminar completamente las cuentas problemáticas
-- angelicawinter (ID: fe54995d-1828-4721-8153-53fce6f4fe56)
-- maiteflores (ID: 411902e6-a96d-4c8a-823b-2b92469ab469)

-- IDs de las cuentas problemáticas
-- angelicawinter: fe54995d-1828-4721-8153-53fce6f4fe56
-- maiteflores: 411902e6-a96d-4c8a-823b-2b92469ab469

BEGIN;

-- 1. Eliminar anticipos
DELETE FROM anticipos 
WHERE model_id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

-- 2. Eliminar calculator_totals
DELETE FROM calculator_totals 
WHERE model_id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

-- 3. Eliminar calculator_history
DELETE FROM calculator_history 
WHERE model_id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

-- 4. Eliminar model_values
DELETE FROM model_values 
WHERE model_id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

-- 5. Eliminar user_groups
DELETE FROM user_groups 
WHERE user_id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

-- 6. Eliminar usuarios principales
DELETE FROM users 
WHERE id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

-- Verificar eliminación
SELECT 'Verificando eliminación...' as status;

-- Verificar que no queden registros
SELECT 'Usuarios restantes:' as tabla, COUNT(*) as cantidad 
FROM users 
WHERE id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

SELECT 'User groups restantes:' as tabla, COUNT(*) as cantidad 
FROM user_groups 
WHERE user_id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

SELECT 'Model values restantes:' as tabla, COUNT(*) as cantidad 
FROM model_values 
WHERE model_id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

SELECT 'Calculator history restante:' as tabla, COUNT(*) as cantidad 
FROM calculator_history 
WHERE model_id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

SELECT 'Calculator totals restantes:' as tabla, COUNT(*) as cantidad 
FROM calculator_totals 
WHERE model_id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

SELECT 'Anticipos restantes:' as tabla, COUNT(*) as cantidad 
FROM anticipos 
WHERE model_id IN (
    'fe54995d-1828-4721-8153-53fce6f4fe56',
    '411902e6-a96d-4c8a-823b-2b92469ab469'
);

COMMIT;

-- Mensaje final
SELECT '✅ Eliminación completada exitosamente' as resultado;
