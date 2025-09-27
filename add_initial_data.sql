-- =====================================================
-- 📊 DATOS INICIALES DEL SISTEMA
-- =====================================================
-- Script para agregar datos iniciales necesarios
-- Sin afectar datos existentes
-- =====================================================

-- 1. VERIFICAR DATOS EXISTENTES
-- =====================================================

-- Verificar grupos existentes
SELECT COUNT(*) as grupos_existentes FROM public.groups;

-- Verificar organizaciones existentes
SELECT COUNT(*) as organizaciones_existentes FROM public.organizations;

-- 2. CREAR ORGANIZACIÓN POR DEFECTO SI NO EXISTE
-- =====================================================

-- Insertar organización principal si no existe
INSERT INTO public.organizations (id, name, description, is_active, created_at)
VALUES (
    gen_random_uuid(),
    'Organización Principal',
    'Organización principal del sistema de gestión',
    true,
    now()
)
ON CONFLICT (name) DO NOTHING;

-- 3. CREAR GRUPOS INICIALES SI NO EXISTEN
-- =====================================================

-- Obtener ID de organización principal
WITH org_id AS (
    SELECT id FROM public.organizations 
    WHERE name = 'Organización Principal' 
    LIMIT 1
)
INSERT INTO public.groups (id, name, description, is_active, organization_id, created_at)
SELECT 
    gen_random_uuid(),
    group_name,
    group_description,
    true,
    org_id.id,
    now()
FROM org_id, (VALUES
    ('Cabecera', 'Grupo Cabecera - Administración principal'),
    ('Diamante', 'Grupo Diamante - Nivel ejecutivo'),
    ('Sede MP', 'Grupo Sede MP - Sede principal'),
    ('Victoria', 'Grupo Victoria - Sede Victoria'),
    ('Terrazas', 'Grupo Terrazas - Sede Terrazas'),
    ('Satélite', 'Grupo Satélite - Sede Satélite'),
    ('Otros', 'Grupo Otros - Categoría general')
) AS groups_data(group_name, group_description)
ON CONFLICT (name, organization_id) DO NOTHING;

-- 4. CREAR SUPER ADMIN SI NO EXISTE
-- =====================================================

-- Verificar si existe super admin
DO $$
DECLARE
    super_admin_exists BOOLEAN;
    org_id UUID;
BEGIN
    -- Verificar si existe super admin
    SELECT EXISTS(
        SELECT 1 FROM public.users 
        WHERE role = 'super_admin'
    ) INTO super_admin_exists;
    
    -- Obtener ID de organización
    SELECT id FROM public.organizations 
    WHERE name = 'Organización Principal' 
    LIMIT 1 INTO org_id;
    
    -- Crear super admin si no existe
    IF NOT super_admin_exists THEN
        INSERT INTO public.users (
            id,
            name,
            email,
            role,
            is_active,
            organization_id,
            created_at
        ) VALUES (
            gen_random_uuid(),
            'Super Administrador',
            'superadmin@example.com',
            'super_admin',
            true,
            org_id,
            now()
        );
        
        RAISE NOTICE 'Super Admin creado exitosamente';
    ELSE
        RAISE NOTICE 'Super Admin ya existe';
    END IF;
END $$;

-- 5. ASIGNAR SUPER ADMIN A TODOS LOS GRUPOS
-- =====================================================

-- Asignar super admin a todos los grupos
WITH super_admin AS (
    SELECT id FROM public.users 
    WHERE role = 'super_admin' 
    LIMIT 1
),
all_groups AS (
    SELECT id FROM public.groups
)
INSERT INTO public.user_groups (id, user_id, group_id, is_manager, joined_at)
SELECT 
    gen_random_uuid(),
    super_admin.id,
    all_groups.id,
    true,
    now()
FROM super_admin, all_groups
ON CONFLICT (user_id, group_id) DO NOTHING;

-- 6. VERIFICAR DATOS CREADOS
-- =====================================================

-- Verificar organizaciones
SELECT id, name, description, is_active, created_at
FROM public.organizations
ORDER BY created_at;

-- Verificar grupos
SELECT id, name, description, organization_id, is_active, created_at
FROM public.groups
ORDER BY name;

-- Verificar usuarios
SELECT id, name, email, role, is_active, organization_id, created_at
FROM public.users
ORDER BY created_at;

-- Verificar asignaciones de grupos
SELECT 
    ug.id,
    u.name as usuario,
    u.role,
    g.name as grupo,
    ug.is_manager,
    ug.joined_at
FROM public.user_groups ug
JOIN public.users u ON ug.user_id = u.id
JOIN public.groups g ON ug.group_id = g.id
ORDER BY u.name, g.name;

-- 7. ESTADÍSTICAS FINALES
-- =====================================================

SELECT 
    'Organizaciones' as tabla,
    COUNT(*) as total
FROM public.organizations
UNION ALL
SELECT 
    'Grupos' as tabla,
    COUNT(*) as total
FROM public.groups
UNION ALL
SELECT 
    'Usuarios' as tabla,
    COUNT(*) as total
FROM public.users
UNION ALL
SELECT 
    'Asignaciones de Grupos' as tabla,
    COUNT(*) as total
FROM public.user_groups;
