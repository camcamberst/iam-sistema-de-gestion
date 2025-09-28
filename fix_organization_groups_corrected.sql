-- =====================================================
-- 🏢 CORRECCIÓN DE organization_id EN GRUPOS (CORREGIDO)
-- =====================================================
-- Script para agregar organization_id a grupos existentes
-- Sin afectar la funcionalidad existente
-- =====================================================

-- 1. VERIFICAR ESTRUCTURA ACTUAL
-- =====================================================

-- Verificar estructura actual de groups
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'groups'
ORDER BY ordinal_position;

-- Verificar estructura actual de organizations
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'organizations'
ORDER BY ordinal_position;

-- 2. AGREGAR COLUMNAS FALTANTES
-- =====================================================

-- Agregar is_active a organizations si no existe
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Agregar description a organizations si no existe
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Agregar created_at a organizations si no existe
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Agregar organization_id a groups si no existe
ALTER TABLE public.groups 
ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 3. CREAR ORGANIZACIÓN POR DEFECTO SI NO EXISTE
-- =====================================================

-- Insertar organización por defecto si no existe
INSERT INTO public.organizations (id, name, description, is_active, created_at)
VALUES (
    gen_random_uuid(),
    'Organización Principal',
    'Organización principal del sistema',
    true,
    now()
)
ON CONFLICT (name) DO NOTHING;

-- 4. ACTUALIZAR GRUPOS EXISTENTES CON organization_id
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

-- 5. HACER organization_id NOT NULL
-- =====================================================

-- Hacer organization_id obligatorio
ALTER TABLE public.groups 
ALTER COLUMN organization_id SET NOT NULL;

-- 6. CREAR ÍNDICE PARA MEJORAR RENDIMIENTO
-- =====================================================

-- Crear índice en organization_id
CREATE INDEX IF NOT EXISTS idx_groups_organization_id 
ON public.groups(organization_id);

-- 7. VERIFICAR CAMBIOS
-- =====================================================

-- Verificar que todos los grupos tienen organization_id
SELECT id, name, organization_id, created_at
FROM public.groups
ORDER BY created_at;

-- Verificar estructura final de groups
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'groups'
ORDER BY ordinal_position;

-- Verificar estructura final de organizations
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'organizations'
ORDER BY ordinal_position;
