-- =====================================================
-- AGREGAR COLUMNA login_url A calculator_platforms
-- =====================================================
-- Permite guardar el URL de login por plataforma
-- Este URL es el mismo para todas las modelos de la misma plataforma
-- =====================================================

-- Agregar columna para URL de login
ALTER TABLE public.calculator_platforms 
ADD COLUMN IF NOT EXISTS login_url TEXT;

-- Crear índice para búsquedas por URL
CREATE INDEX IF NOT EXISTS idx_calculator_platforms_login_url 
ON public.calculator_platforms(id) 
WHERE login_url IS NOT NULL;

-- Comentario para documentación
COMMENT ON COLUMN public.calculator_platforms.login_url IS 'URL de login de la plataforma (común para todas las modelos)';

-- Recargar esquema
NOTIFY pgrst, 'reload schema';

