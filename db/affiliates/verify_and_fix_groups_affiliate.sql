-- =====================================================
-- 🔧 VERIFICAR Y CORREGIR: COLUMNA affiliate_studio_id EN groups
-- =====================================================
-- Este script verifica si la columna existe y la crea si no existe
-- =====================================================

-- 1. Verificar si la columna existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'groups' 
        AND column_name = 'affiliate_studio_id'
    ) THEN
        -- La columna no existe, crearla
        ALTER TABLE groups 
        ADD COLUMN affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;
        
        RAISE NOTICE '✅ Columna affiliate_studio_id agregada a la tabla groups';
    ELSE
        RAISE NOTICE '✅ Columna affiliate_studio_id ya existe en la tabla groups';
    END IF;
END $$;

-- 2. Verificar si el índice existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'groups' 
        AND indexname = 'idx_groups_affiliate_studio_id'
    ) THEN
        -- El índice no existe, crearlo
        CREATE INDEX idx_groups_affiliate_studio_id ON groups(affiliate_studio_id);
        
        RAISE NOTICE '✅ Índice idx_groups_affiliate_studio_id creado';
    ELSE
        RAISE NOTICE '✅ Índice idx_groups_affiliate_studio_id ya existe';
    END IF;
END $$;

-- 3. Verificar estructura final
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'groups' 
AND column_name = 'affiliate_studio_id';

-- 4. Verificar índice
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'groups' 
AND indexname = 'idx_groups_affiliate_studio_id';
