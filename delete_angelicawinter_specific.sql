-- Script específico para eliminar angelicawinter completamente
-- ID: fe54995d-1828-4721-8153-53fce6f4fe56

BEGIN;

-- Verificar qué datos existen antes de eliminar
SELECT 'ANTES DE ELIMINAR - Verificando datos existentes:' as status;

SELECT 'Usuarios:' as tabla, COUNT(*) as cantidad 
FROM users 
WHERE id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'User groups:' as tabla, COUNT(*) as cantidad 
FROM user_groups 
WHERE user_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Model values:' as tabla, COUNT(*) as cantidad 
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Calculator history:' as tabla, COUNT(*) as cantidad 
FROM calculator_history 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Calculator totals:' as tabla, COUNT(*) as cantidad 
FROM calculator_totals 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Anticipos:' as tabla, COUNT(*) as cantidad 
FROM anticipos 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

-- Eliminar en orden correcto (respetando foreign keys)
SELECT 'INICIANDO ELIMINACIÓN...' as status;

-- 1. Eliminar anticipos
DELETE FROM anticipos 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Anticipos eliminados' as status;

-- 2. Eliminar calculator_totals
DELETE FROM calculator_totals 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Calculator totals eliminados' as status;

-- 3. Eliminar calculator_history
DELETE FROM calculator_history 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Calculator history eliminado' as status;

-- 4. Eliminar model_values
DELETE FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Model values eliminados' as status;

-- 5. Eliminar user_groups
DELETE FROM user_groups 
WHERE user_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'User groups eliminados' as status;

-- 6. Eliminar usuario principal
DELETE FROM users 
WHERE id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Usuario principal eliminado' as status;

-- Verificar eliminación
SELECT 'DESPUÉS DE ELIMINAR - Verificando eliminación:' as status;

SELECT 'Usuarios restantes:' as tabla, COUNT(*) as cantidad 
FROM users 
WHERE id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'User groups restantes:' as tabla, COUNT(*) as cantidad 
FROM user_groups 
WHERE user_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Model values restantes:' as tabla, COUNT(*) as cantidad 
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Calculator history restante:' as tabla, COUNT(*) as cantidad 
FROM calculator_history 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Calculator totals restantes:' as tabla, COUNT(*) as cantidad 
FROM calculator_totals 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT 'Anticipos restantes:' as tabla, COUNT(*) as cantidad 
FROM anticipos 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

COMMIT;

-- Mensaje final
SELECT '✅ Eliminación de angelicawinter completada' as resultado;
