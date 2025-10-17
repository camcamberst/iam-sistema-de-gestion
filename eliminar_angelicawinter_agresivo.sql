-- =====================================================
-- ELIMINACIÓN AGRESIVA DE angelicawinter@tuemailya.com
-- =====================================================
-- Script para eliminar TODOS los rastros posibles
-- Incluye tablas de autenticación y cualquier referencia
-- =====================================================

BEGIN;

-- 1. VERIFICAR EXISTENCIA EN TODAS LAS TABLAS POSIBLES
SELECT 'VERIFICANDO EXISTENCIA EN TODAS LAS TABLAS' as status;

-- Verificar en users
SELECT 'users:' as tabla, COUNT(*) as cantidad 
FROM users 
WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%';

-- Verificar en auth.users (tabla de autenticación de Supabase)
SELECT 'auth.users:' as tabla, COUNT(*) as cantidad 
FROM auth.users 
WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%';

-- Verificar en todas las tablas que puedan tener referencias
SELECT 'chat_messages:' as tabla, COUNT(*) as cantidad 
FROM chat_messages 
WHERE sender_id IN (
    SELECT id FROM users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
);

SELECT 'anticipos:' as tabla, COUNT(*) as cantidad 
FROM anticipos 
WHERE model_id IN (
    SELECT id FROM users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
);

SELECT 'calculator_totals:' as tabla, COUNT(*) as cantidad 
FROM calculator_totals 
WHERE model_id IN (
    SELECT id FROM users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
);

SELECT 'calculator_history:' as tabla, COUNT(*) as cantidad 
FROM calculator_history 
WHERE model_id IN (
    SELECT id FROM users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
);

SELECT 'model_values:' as tabla, COUNT(*) as cantidad 
FROM model_values 
WHERE model_id IN (
    SELECT id FROM users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
);

SELECT 'room_assignments:' as tabla, COUNT(*) as cantidad 
FROM room_assignments 
WHERE model_id IN (
    SELECT id FROM users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
);

SELECT 'user_groups:' as tabla, COUNT(*) as cantidad 
FROM user_groups 
WHERE user_id IN (
    SELECT id FROM users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email = 'angelicawinter@tuemailya.com' OR email ILIKE '%angelicawinter%'
);

-- 2. ELIMINACIÓN AGRESIVA
DO $$
DECLARE
    user_count INTEGER;
    auth_user_count INTEGER;
    user_id_var UUID;
    auth_user_id_var UUID;
BEGIN
    -- Obtener IDs de ambas tablas
    SELECT id INTO user_id_var FROM users WHERE email = 'angelicawinter@tuemailya.com' LIMIT 1;
    SELECT id INTO auth_user_id_var FROM auth.users WHERE email = 'angelicawinter@tuemailya.com' LIMIT 1;
    
    RAISE NOTICE 'Iniciando eliminación agresiva...';
    RAISE NOTICE 'User ID (users): %', user_id_var;
    RAISE NOTICE 'User ID (auth.users): %', auth_user_id_var;
    
    -- Eliminar de todas las tablas usando ambos IDs
    IF user_id_var IS NOT NULL OR auth_user_id_var IS NOT NULL THEN
        
        -- Usar el ID que esté disponible
        IF user_id_var IS NOT NULL THEN
            -- Eliminar usando ID de users
            DELETE FROM chat_messages WHERE sender_id = user_id_var;
            DELETE FROM anticipos WHERE model_id = user_id_var;
            DELETE FROM calculator_totals WHERE model_id = user_id_var;
            DELETE FROM calculator_history WHERE model_id = user_id_var;
            DELETE FROM model_values WHERE model_id = user_id_var;
            DELETE FROM room_assignments WHERE model_id = user_id_var;
            DELETE FROM user_groups WHERE user_id = user_id_var;
            DELETE FROM users WHERE id = user_id_var;
            RAISE NOTICE 'Eliminado usando ID de users: %', user_id_var;
        END IF;
        
        IF auth_user_id_var IS NOT NULL THEN
            -- Eliminar usando ID de auth.users
            DELETE FROM chat_messages WHERE sender_id = auth_user_id_var;
            DELETE FROM anticipos WHERE model_id = auth_user_id_var;
            DELETE FROM calculator_totals WHERE model_id = auth_user_id_var;
            DELETE FROM calculator_history WHERE model_id = auth_user_id_var;
            DELETE FROM model_values WHERE model_id = auth_user_id_var;
            DELETE FROM room_assignments WHERE model_id = auth_user_id_var;
            DELETE FROM user_groups WHERE user_id = auth_user_id_var;
            DELETE FROM users WHERE id = auth_user_id_var;
            -- Eliminar de auth.users también
            DELETE FROM auth.users WHERE id = auth_user_id_var;
            RAISE NOTICE 'Eliminado usando ID de auth.users: %', auth_user_id_var;
        END IF;
        
        RAISE NOTICE '✅ Eliminación agresiva completada';
        
    ELSE
        RAISE NOTICE 'ℹ️ No se encontraron registros para eliminar';
    END IF;
    
    -- Eliminar también cualquier registro que contenga "angelicawinter" en el email
    DELETE FROM chat_messages WHERE sender_id IN (
        SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
        UNION
        SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
    );
    
    DELETE FROM anticipos WHERE model_id IN (
        SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
        UNION
        SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
    );
    
    DELETE FROM calculator_totals WHERE model_id IN (
        SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
        UNION
        SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
    );
    
    DELETE FROM calculator_history WHERE model_id IN (
        SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
        UNION
        SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
    );
    
    DELETE FROM model_values WHERE model_id IN (
        SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
        UNION
        SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
    );
    
    DELETE FROM room_assignments WHERE model_id IN (
        SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
        UNION
        SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
    );
    
    DELETE FROM user_groups WHERE user_id IN (
        SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
        UNION
        SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
    );
    
    DELETE FROM users WHERE email ILIKE '%angelicawinter%';
    DELETE FROM auth.users WHERE email ILIKE '%angelicawinter%';
    
    RAISE NOTICE '✅ Eliminación por patrón completada';
    
END $$;

-- 3. VERIFICACIÓN FINAL AGRESIVA
SELECT 'VERIFICACIÓN FINAL AGRESIVA' as status;

SELECT 'users (exacto):' as tabla, COUNT(*) as cantidad 
FROM users 
WHERE email = 'angelicawinter@tuemailya.com';

SELECT 'users (patrón):' as tabla, COUNT(*) as cantidad 
FROM users 
WHERE email ILIKE '%angelicawinter%';

SELECT 'auth.users (exacto):' as tabla, COUNT(*) as cantidad 
FROM auth.users 
WHERE email = 'angelicawinter@tuemailya.com';

SELECT 'auth.users (patrón):' as tabla, COUNT(*) as cantidad 
FROM auth.users 
WHERE email ILIKE '%angelicawinter%';

-- Verificar que no queden referencias en ninguna tabla
SELECT 'chat_messages restantes:' as tabla, COUNT(*) as cantidad 
FROM chat_messages 
WHERE sender_id IN (
    SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
);

SELECT 'anticipos restantes:' as tabla, COUNT(*) as cantidad 
FROM anticipos 
WHERE model_id IN (
    SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
);

SELECT 'calculator_totals restantes:' as tabla, COUNT(*) as cantidad 
FROM calculator_totals 
WHERE model_id IN (
    SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
);

SELECT 'calculator_history restantes:' as tabla, COUNT(*) as cantidad 
FROM calculator_history 
WHERE model_id IN (
    SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
);

SELECT 'model_values restantes:' as tabla, COUNT(*) as cantidad 
FROM model_values 
WHERE model_id IN (
    SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
);

SELECT 'room_assignments restantes:' as tabla, COUNT(*) as cantidad 
FROM room_assignments 
WHERE model_id IN (
    SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
);

SELECT 'user_groups restantes:' as tabla, COUNT(*) as cantidad 
FROM user_groups 
WHERE user_id IN (
    SELECT id FROM users WHERE email ILIKE '%angelicawinter%'
    UNION
    SELECT id FROM auth.users WHERE email ILIKE '%angelicawinter%'
);

COMMIT;

-- Mensaje final
SELECT '🎉 ELIMINACIÓN AGRESIVA COMPLETADA' as resultado;
SELECT '✅ angelicawinter@tuemailya.com eliminado de TODAS las tablas' as resultado;
SELECT '✅ Eliminado de users y auth.users' as resultado;
SELECT '✅ Eliminado por patrón (cualquier variación del email)' as resultado;
SELECT '✅ Ahora puedes registrar el email nuevamente' as resultado;
