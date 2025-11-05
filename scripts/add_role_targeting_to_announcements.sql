-- =====================================================
-- 📌 AGREGAR SELECCIÓN POR ROL A PUBLICACIONES
-- =====================================================
-- Permite que el super admin seleccione roles específicos
-- como destinatarios de publicaciones (admin, super_admin)
-- =====================================================

-- Agregar columna para roles objetivo (JSONB array)
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS target_roles JSONB DEFAULT '[]'::jsonb;

-- Índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_announcements_target_roles ON announcements USING GIN (target_roles);

-- Comentario de documentación
COMMENT ON COLUMN announcements.target_roles IS 'Array JSON de roles objetivo: ["admin", "super_admin"]. Vacío [] = no hay restricción por rol';

