-- =====================================================
-- 🔧 VERIFICACIÓN Y CORRECCIÓN DE TRIGGERS
-- =====================================================
-- Script para verificar y corregir triggers de sincronización
-- =====================================================

-- 1. VERIFICAR TRIGGERS EXISTENTES
-- =====================================================

-- Verificar triggers en tabla users
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users'
AND event_object_schema = 'public';

-- 2. CREAR TRIGGER DE SINCRONIZACIÓN SI NO EXISTE
-- =====================================================

-- Función para sincronizar auth.users con public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insertar en public.users cuando se crea en auth.users
    INSERT INTO public.users (
        id,
        name,
        email,
        role,
        is_active,
        organization_id,
        created_at
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'Usuario'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'modelo'),
        true,
        (SELECT id FROM public.organizations LIMIT 1),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(NEW.raw_user_meta_data->>'name', users.name),
        email = NEW.email,
        role = COALESCE(NEW.raw_user_meta_data->>'role', users.role),
        updated_at = now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREAR TRIGGER SI NO EXISTE
-- =====================================================

-- Eliminar trigger existente si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear trigger para sincronización
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. CREAR TRIGGER PARA ACTUALIZACIONES
-- =====================================================

-- Función para actualizar public.users cuando cambia auth.users
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar public.users cuando se actualiza auth.users
    UPDATE public.users SET
        email = NEW.email,
        updated_at = now()
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para actualizaciones
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- 5. CREAR TRIGGER PARA ELIMINACIONES
-- =====================================================

-- Función para eliminar de public.users cuando se elimina de auth.users
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Eliminar de public.users cuando se elimina de auth.users
    DELETE FROM public.users WHERE id = OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para eliminaciones
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- 6. VERIFICAR TRIGGERS CREADOS
-- =====================================================

-- Verificar todos los triggers
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_schema = 'auth'
AND event_object_table = 'users'
ORDER BY trigger_name;

-- 7. PROBAR FUNCIONALIDAD
-- =====================================================

-- Verificar que la función existe y es ejecutable
SELECT routine_name, routine_type, data_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN ('handle_new_user', 'handle_user_update', 'handle_user_delete');
