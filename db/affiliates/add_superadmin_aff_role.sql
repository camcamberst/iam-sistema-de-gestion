-- =====================================================
-- 🆕 AGREGAR ROL 'superadmin_aff' A LA RESTRICCIÓN
-- =====================================================
-- Script para actualizar la restricción users_role_check
-- para incluir el nuevo rol 'superadmin_aff'
-- =====================================================

-- 1. Eliminar constraint existente si existe
DO $$ 
BEGIN
    -- Intentar eliminar constraint si existe
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_role_check' 
        AND table_name = 'users'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE users DROP CONSTRAINT users_role_check;
        RAISE NOTICE '✅ Constraint users_role_check eliminado';
    ELSE
        RAISE NOTICE '⚠️ Constraint users_role_check no encontrado';
    END IF;
END $$;

-- 2. Agregar nuevo constraint con todos los roles válidos
-- Incluyendo: super_admin, admin, modelo, gestor, fotografia, superadmin_aff
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('super_admin', 'admin', 'modelo', 'gestor', 'fotografia', 'superadmin_aff'));

-- 3. Verificar que no haya valores inválidos
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM users
    WHERE role NOT IN ('super_admin', 'admin', 'modelo', 'gestor', 'fotografia', 'superadmin_aff');
    
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
AND column_name = 'role'
AND table_schema = 'public';

-- 5. Mostrar distribución de roles actual
SELECT 
    role,
    COUNT(*) as total_usuarios
FROM users
GROUP BY role
ORDER BY role;

-- 6. Verificar que el constraint se creó correctamente
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'users_role_check'
AND constraint_schema = 'public';
