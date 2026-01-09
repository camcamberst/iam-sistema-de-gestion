-- =====================================================
-- 📢 AGREGAR SOPORTE DE AFILIADOS A ANUNCIOS
-- =====================================================
-- Agrega columnas para filtrar anuncios por estudio afiliado
-- y permitir que el superadmin comparta anuncios con afiliados
-- =====================================================

-- 1. Agregar columna affiliate_studio_id a announcements
-- Los anuncios de estudios afiliados tendrán su affiliate_studio_id
-- Los anuncios de Agencia Innova tendrán affiliate_studio_id = NULL
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS affiliate_studio_id UUID REFERENCES affiliate_studios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_affiliate_studio_id ON announcements(affiliate_studio_id);

-- 2. Agregar columna share_with_affiliates
-- Si es true, el anuncio de Agencia Innova se compartirá con todos los estudios afiliados
-- Solo el superadmin (master) puede marcar esta opción
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS share_with_affiliates BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_announcements_share_with_affiliates ON announcements(share_with_affiliates);

-- 3. Comentarios
COMMENT ON COLUMN announcements.affiliate_studio_id IS 'ID del estudio afiliado. NULL = anuncio de Agencia Innova';
COMMENT ON COLUMN announcements.share_with_affiliates IS 'Si es true, el anuncio de Innova se compartirá con todos los estudios afiliados';

-- 4. Verificar estructura
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'announcements' 
AND column_name IN ('affiliate_studio_id', 'share_with_affiliates')
ORDER BY column_name;
