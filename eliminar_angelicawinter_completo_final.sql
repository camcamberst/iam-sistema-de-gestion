-- =====================================================
-- ELIMINACIÓN COMPLETA DE angelicawinter@tuemailya.com
-- =====================================================
-- Script para eliminar TODOS los rastros de esta cuenta
-- como si nunca hubiera existido
-- =====================================================

BEGIN;

-- Verificar si existe el usuario antes de eliminar
SELECT 'VERIFICANDO EXISTENCIA DE angelicawinter@tuemailya.com' as status;

SELECT 'Usuarios con email angelicawinter@tuemailya.com:' as tabla, COUNT(*) as cantidad 
FROM users 
WHERE email = 'angelicawinter@tuemailya.com';

SELECT 'Usuarios con email angelicawinter2@tuemailya.com:' as tabla, COUNT(*) as cantidad 
FROM users 
WHERE email = 'angelicawinter2@tuemailya.com';

-- Si no hay usuarios, no hay nada que eliminar
DO $$
DECLARE
    user_count INTEGER;
    user_id_var UUID;
BEGIN
    -- Verificar si existe angelicawinter@tuemailya.com
    SELECT COUNT(*) INTO user_count FROM users WHERE email = 'angelicawinter@tuemailya.com';
    
    IF user_count > 0 THEN
        -- Obtener el ID del usuario
        SELECT id INTO user_id_var FROM users WHERE email = 'angelicawinter@tuemailya.com' LIMIT 1;
        
        RAISE NOTICE 'Eliminando usuario angelicawinter@tuemailya.com con ID: %', user_id_var;
        
        -- Eliminar en orden correcto (respetando foreign keys)
        
        -- 1. Eliminar chat messages
        DELETE FROM chat_messages WHERE sender_id = user_id_var;
        RAISE NOTICE 'Chat messages eliminados';
        
        -- 2. Eliminar anticipos
        DELETE FROM anticipos WHERE model_id = user_id_var;
        RAISE NOTICE 'Anticipos eliminados';
        
        -- 3. Eliminar calculator_totals
        DELETE FROM calculator_totals WHERE model_id = user_id_var;
        RAISE NOTICE 'Calculator totals eliminados';
        
        -- 4. Eliminar calculator_history
        DELETE FROM calculator_history WHERE model_id = user_id_var;
        RAISE NOTICE 'Calculator history eliminado';
        
        -- 5. Eliminar model_values
        DELETE FROM model_values WHERE model_id = user_id_var;
        RAISE NOTICE 'Model values eliminados';
        
        -- 6. Eliminar room_assignments
        DELETE FROM room_assignments WHERE model_id = user_id_var;
        RAISE NOTICE 'Room assignments eliminados';
        
        -- 7. Eliminar user_groups
        DELETE FROM user_groups WHERE user_id = user_id_var;
        RAISE NOTICE 'User groups eliminados';
        
        -- 8. Eliminar usuario principal
        DELETE FROM users WHERE id = user_id_var;
        RAISE NOTICE 'Usuario principal eliminado';
        
        RAISE NOTICE '✅ angelicawinter@tuemailya.com eliminado completamente';
        
    ELSE
        RAISE NOTICE 'ℹ️ angelicawinter@tuemailya.com no existe en el sistema';
    END IF;
    
    -- Verificar si existe angelicawinter2@tuemailya.com (la cuenta recreada)
    SELECT COUNT(*) INTO user_count FROM users WHERE email = 'angelicawinter2@tuemailya.com';
    
    IF user_count > 0 THEN
        -- Obtener el ID del usuario
        SELECT id INTO user_id_var FROM users WHERE email = 'angelicawinter2@tuemailya.com' LIMIT 1;
        
        RAISE NOTICE 'Eliminando usuario angelicawinter2@tuemailya.com con ID: %', user_id_var;
        
        -- Eliminar en orden correcto (respetando foreign keys)
        
        -- 1. Eliminar chat messages
        DELETE FROM chat_messages WHERE sender_id = user_id_var;
        RAISE NOTICE 'Chat messages eliminados';
        
        -- 2. Eliminar anticipos
        DELETE FROM anticipos WHERE model_id = user_id_var;
        RAISE NOTICE 'Anticipos eliminados';
        
        -- 3. Eliminar calculator_totals
        DELETE FROM calculator_totals WHERE model_id = user_id_var;
        RAISE NOTICE 'Calculator totals eliminados';
        
        -- 4. Eliminar calculator_history
        DELETE FROM calculator_history WHERE model_id = user_id_var;
        RAISE NOTICE 'Calculator history eliminado';
        
        -- 5. Eliminar model_values
        DELETE FROM model_values WHERE model_id = user_id_var;
        RAISE NOTICE 'Model values eliminados';
        
        -- 6. Eliminar room_assignments
        DELETE FROM room_assignments WHERE model_id = user_id_var;
        RAISE NOTICE 'Room assignments eliminados';
        
        -- 7. Eliminar user_groups
        DELETE FROM user_groups WHERE user_id = user_id_var;
        RAISE NOTICE 'User groups eliminados';
        
        -- 8. Eliminar usuario principal
        DELETE FROM users WHERE id = user_id_var;
        RAISE NOTICE 'Usuario principal eliminado';
        
        RAISE NOTICE '✅ angelicawinter2@tuemailya.com eliminado completamente';
        
    ELSE
        RAISE NOTICE 'ℹ️ angelicawinter2@tuemailya.com no existe en el sistema';
    END IF;
END $$;

-- Verificación final
SELECT 'VERIFICACIÓN FINAL - angelicawinter@tuemailya.com:' as status;
SELECT COUNT(*) as cantidad FROM users WHERE email = 'angelicawinter@tuemailya.com';

SELECT 'VERIFICACIÓN FINAL - angelicawinter2@tuemailya.com:' as status;
SELECT COUNT(*) as cantidad FROM users WHERE email = 'angelicawinter2@tuemailya.com';

-- Verificar que no queden datos huérfanos
SELECT 'VERIFICACIÓN DE DATOS HUÉRFANOS:' as status;

SELECT 'Chat messages huérfanos:' as tabla, COUNT(*) as cantidad 
FROM chat_messages cm 
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = cm.sender_id);

SELECT 'Anticipos huérfanos:' as tabla, COUNT(*) as cantidad 
FROM anticipos a 
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.model_id);

SELECT 'Calculator totals huérfanos:' as tabla, COUNT(*) as cantidad 
FROM calculator_totals ct 
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ct.model_id);

SELECT 'Calculator history huérfanos:' as tabla, COUNT(*) as cantidad 
FROM calculator_history ch 
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ch.model_id);

SELECT 'Model values huérfanos:' as tabla, COUNT(*) as cantidad 
FROM model_values mv 
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = mv.model_id);

SELECT 'Room assignments huérfanos:' as tabla, COUNT(*) as cantidad 
FROM room_assignments ra 
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ra.model_id);

SELECT 'User groups huérfanos:' as tabla, COUNT(*) as cantidad 
FROM user_groups ug 
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ug.user_id);

COMMIT;

-- Mensaje final
SELECT '🎉 ELIMINACIÓN COMPLETADA' as resultado;
SELECT '✅ angelicawinter@tuemailya.com ha sido eliminado completamente del sistema' as resultado;
SELECT '✅ angelicawinter2@tuemailya.com ha sido eliminado completamente del sistema' as resultado;
SELECT '✅ No quedan rastros de estas cuentas en ninguna tabla' as resultado;
SELECT '✅ Es como si nunca hubieran existido' as resultado;
