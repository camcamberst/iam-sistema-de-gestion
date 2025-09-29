-- =====================================================
-- 🗑️ ELIMINAR TRIGGER AUTOMÁTICO DUPLICADO
-- =====================================================
-- Script para eliminar el trigger que causa duplicación
-- =====================================================

-- 1. 🧹 ELIMINAR TRIGGER PROBLEMÁTICO
-- =====================================================

-- Eliminar trigger que causa duplicación
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. 🧹 ELIMINAR FUNCIÓN ASOCIADA (OPCIONAL)
-- =====================================================

-- Eliminar función handle_new_user (ya no se necesita)
DROP FUNCTION IF EXISTS handle_new_user();

-- 3. ✅ VERIFICAR ELIMINACIÓN
-- =====================================================

-- Verificar que el trigger fue eliminado
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_schema = 'auth'
AND event_object_table = 'users'
AND trigger_name = 'on_auth_user_created';

-- 4. 📋 CONFIRMAR ESTADO
-- =====================================================

-- Mostrar triggers restantes en auth.users
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_schema = 'auth'
AND event_object_table = 'users'
ORDER BY trigger_name;

-- 5. 🎯 MENSAJE DE CONFIRMACIÓN
-- =====================================================

-- El trigger duplicado ha sido eliminado
-- Ahora la API puede crear usuarios sin conflictos
-- La creación será manejada únicamente por la API /api/users
