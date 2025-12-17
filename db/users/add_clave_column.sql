-- =====================================================
-- AGREGAR COLUMNA 'clave' A TABLA users
-- =====================================================
-- Esta columna almacena el password visible del usuario
-- para mostrarlo en la planilla de Gestor Stats
-- =====================================================

-- Agregar columna 'clave' si no existe
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS clave TEXT;

-- Crear índice para búsquedas por clave
CREATE INDEX IF NOT EXISTS idx_users_clave ON public.users(clave) WHERE clave IS NOT NULL;

-- Comentario para documentación
COMMENT ON COLUMN public.users.clave IS 'Password visible del usuario para mostrar en planillas del gestor';

-- Recargar esquema
NOTIFY pgrst, 'reload schema';

