-- Script SQL para eliminar completamente angelicawinter
-- ID: fe54995d-1828-4721-8153-53fce6f4fe56
-- Email: angelicawinter@tuemailya.com

BEGIN;

-- Verificar datos existentes antes de eliminar
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

SELECT 'Chat messages:' as tabla, COUNT(*) as cantidad 
FROM chat_messages 
WHERE sender_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

-- INICIAR ELIMINACIÓN EN ORDEN CORRECTO
SELECT 'INICIANDO ELIMINACIÓN COMPLETA...' as status;

-- 1. Eliminar chat messages
DELETE FROM chat_messages 
WHERE sender_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT '✅ Chat messages eliminados' as status;

-- 2. Eliminar anticipos
DELETE FROM anticipos 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT '✅ Anticipos eliminados' as status;

-- 3. Eliminar calculator_totals
DELETE FROM calculator_totals 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT '✅ Calculator totals eliminados' as status;

-- 4. Eliminar calculator_history
DELETE FROM calculator_history 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT '✅ Calculator history eliminado' as status;

-- 5. Eliminar model_values
DELETE FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT '✅ Model values eliminados' as status;

-- 6. Eliminar user_groups
DELETE FROM user_groups 
WHERE user_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT '✅ User groups eliminados' as status;

-- 7. Eliminar usuario principal
DELETE FROM users 
WHERE id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

SELECT '✅ Usuario principal eliminado' as status;

-- VERIFICAR ELIMINACIÓN
SELECT 'VERIFICANDO ELIMINACIÓN COMPLETA...' as status;

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

SELECT 'Chat messages restantes:' as tabla, COUNT(*) as cantidad 
FROM chat_messages 
WHERE sender_id = 'fe54995d-1828-4721-8153-53fce6f4fe56';

COMMIT;

-- Mensaje final
SELECT '🎉 ELIMINACIÓN COMPLETADA EXITOSAMENTE' as resultado;
SELECT '✅ angelicawinter@tuemailya.com ha sido eliminada completamente' as resultado;
SELECT '✅ Ya no aparecerá en el Resumen de Facturación' as resultado;
SELECT '✅ Puedes proceder a crear la cuenta nuevamente' as resultado;
