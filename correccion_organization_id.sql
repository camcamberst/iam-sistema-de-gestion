-- =====================================================
-- 🔧 CORRECCIÓN ESPECÍFICA: organization_id EN groups
-- =====================================================
-- Script para agregar organization_id a la tabla groups
-- =====================================================

-- 1. AGREGAR organization_id A groups
-- =====================================================

-- Agregar columna organization_id si no existe
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 2. CREAR ORGANIZACIÓN POR DEFECTO SI NO EXISTE
-- =====================================================

-- Verificar si ya existe la organización
DO $$
DECLARE
    org_exists BOOLEAN;
BEGIN
    -- Verificar si existe la organización
    SELECT EXISTS(
        SELECT 1 FROM public.organizations 
        WHERE name = 'Organización Principal'
    ) INTO org_exists;
    
    -- Crear organización si no existe
    IF NOT org_exists THEN
        INSERT INTO public.organizations (id, name, description, is_active, created_at)
        VALUES (
            gen_random_uuid(),
            'Organización Principal',
            'Organización principal del sistema',
            true,
            now()
        );
        
        RAISE NOTICE 'Organización Principal creada exitosamente';
    ELSE
        RAISE NOTICE 'Organización Principal ya existe';
    END IF;
END $$;

-- 3. ACTUALIZAR GRUPOS EXISTENTES CON organization_id
-- =====================================================

-- Obtener el ID de la organización por defecto
WITH default_org AS (
    SELECT id FROM public.organizations 
    WHERE name = 'Organización Principal' 
    LIMIT 1
)
UPDATE public.groups 
SET organization_id = default_org.id
FROM default_org
WHERE public.groups.organization_id IS NULL;

-- 4. HACER organization_id NOT NULL
-- =====================================================

-- Hacer organization_id obligatorio
ALTER TABLE public.groups 
ALTER COLUMN organization_id SET NOT NULL;

-- 5. CREAR ÍNDICE PARA MEJORAR RENDIMIENTO
-- =====================================================

-- Crear índice en organization_id
CREATE INDEX IF NOT EXISTS idx_groups_organization_id 
ON public.groups(organization_id);

-- 6. VERIFICAR CAMBIOS
-- =====================================================

-- Verificar que todos los grupos tienen organization_id
SELECT 'GRUPOS CON organization_id:' as info;
SELECT id, name, organization_id, created_at
FROM public.groups
ORDER BY created_at;

-- Verificar estructura final de groups
SELECT 'ESTRUCTURA FINAL DE groups:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'groups'
ORDER BY ordinal_position;
