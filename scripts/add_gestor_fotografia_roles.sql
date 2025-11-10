-- =====================================================
-- 🆕 AGREGAR ROLES GESTOR Y FOTOGRAFÍA
-- =====================================================
-- Script para actualizar la base de datos con los nuevos roles
-- =====================================================

-- Verificar si la columna 'role' en la tabla 'users' tiene un CHECK constraint
-- Si existe, necesitamos actualizarlo para incluir los nuevos roles

-- 1. Eliminar constraint existente si existe (ajusta el nombre según tu esquema)
DO $$ 
BEGIN
    -- Intentar eliminar constraint si existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_role_check' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
    END IF;
END $$;

-- 2. Agregar nuevo constraint con los roles actualizados
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('super_admin', 'admin', 'modelo', 'gestor', 'fotografia'));

-- 3. Verificar que no haya valores inválidos
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM users
    WHERE role NOT IN ('super_admin', 'admin', 'modelo', 'gestor', 'fotografia');
    
    IF invalid_count > 0 THEN
        RAISE NOTICE '⚠️ Advertencia: Se encontraron % usuarios con roles inválidos', invalid_count;
        RAISE NOTICE 'Por favor, actualiza manualmente estos usuarios antes de continuar.';
    ELSE
        RAISE NOTICE '✅ Todos los usuarios tienen roles válidos';
    END IF;
END $$;

-- 4. Verificar estructura de la tabla users
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name = 'role';

-- 5. Mostrar distribución de roles actual
SELECT 
    role,
    COUNT(*) as total_usuarios,
    COUNT(*) FILTER (WHERE is_active = true) as usuarios_activos,
    COUNT(*) FILTER (WHERE is_active = false) as usuarios_inactivos
FROM users
GROUP BY role
ORDER BY 
    CASE role
        WHEN 'super_admin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'gestor' THEN 3
        WHEN 'fotografia' THEN 4
        WHEN 'modelo' THEN 5
        ELSE 6
    END;

-- =====================================================
-- ✅ VERIFICACIÓN FINAL
-- =====================================================
-- Ejecuta este script y verifica que:
-- 1. El constraint se haya actualizado correctamente
-- 2. No haya usuarios con roles inválidos
-- 3. La distribución de roles sea la esperada


