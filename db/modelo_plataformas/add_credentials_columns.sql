-- =====================================================
-- AGREGAR COLUMNAS DE CREDENCIALES A modelo_plataformas
-- =====================================================
-- Permite guardar credenciales de login para plataformas entregadas
-- Las contraseñas se almacenan encriptadas
-- =====================================================

-- Agregar columnas para credenciales de login
ALTER TABLE public.modelo_plataformas 
ADD COLUMN IF NOT EXISTS login_url TEXT,
ADD COLUMN IF NOT EXISTS login_username TEXT,
ADD COLUMN IF NOT EXISTS login_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS credentials_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS credentials_updated_by UUID REFERENCES auth.users(id);

-- Crear índice para búsquedas por credenciales
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_has_credentials 
ON public.modelo_plataformas(id) 
WHERE login_url IS NOT NULL AND login_username IS NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN public.modelo_plataformas.login_url IS 'URL de login de la plataforma';
COMMENT ON COLUMN public.modelo_plataformas.login_username IS 'Usuario/email de login de la plataforma';
COMMENT ON COLUMN public.modelo_plataformas.login_password_encrypted IS 'Contraseña encriptada usando AES-256-GCM';
COMMENT ON COLUMN public.modelo_plataformas.credentials_updated_at IS 'Fecha de última actualización de credenciales';
COMMENT ON COLUMN public.modelo_plataformas.credentials_updated_by IS 'Usuario que actualizó las credenciales';

-- Recargar esquema
NOTIFY pgrst, 'reload schema';

