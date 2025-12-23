-- =====================================================
-- AGREGAR COLUMNAS DE CREDENCIALES 3CX A modelo_plataformas
-- =====================================================
-- Permite guardar credenciales específicas para la App de llamadas 3CX
-- Las contraseñas se almacenan encriptadas
-- =====================================================

-- Agregar columnas para credenciales de 3CX
ALTER TABLE public.modelo_plataformas 
ADD COLUMN IF NOT EXISTS app_3cx_username TEXT,
ADD COLUMN IF NOT EXISTS app_3cx_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS app_3cx_credentials_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS app_3cx_credentials_updated_by UUID REFERENCES auth.users(id);

-- Comentarios para documentación
COMMENT ON COLUMN public.modelo_plataformas.app_3cx_username IS 'Usuario para la App de llamadas 3CX de Superfoon';
COMMENT ON COLUMN public.modelo_plataformas.app_3cx_password_encrypted IS 'Contraseña encriptada para la App de llamadas 3CX usando AES-256-GCM';
COMMENT ON COLUMN public.modelo_plataformas.app_3cx_credentials_updated_at IS 'Fecha de última actualización de credenciales 3CX';
COMMENT ON COLUMN public.modelo_plataformas.app_3cx_credentials_updated_by IS 'Usuario que actualizó las credenciales 3CX';

-- Recargar esquema
NOTIFY pgrst, 'reload schema';

