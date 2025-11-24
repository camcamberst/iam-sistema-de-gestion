-- =====================================================
-- 📁 AGREGAR CAMPO GOOGLE DRIVE FOLDER URL A USERS
-- =====================================================
-- Este campo almacenará el enlace único de Google Drive
-- para cada modelo, permitiendo la integración con "Boost Pages"
-- =====================================================

-- 1. Agregar columna google_drive_folder_url a la tabla users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_drive_folder_url TEXT;

-- 2. Agregar comentario descriptivo
COMMENT ON COLUMN users.google_drive_folder_url IS 'URL del folder de Google Drive para Boost Pages de la modelo';

-- 3. Crear índice para mejorar búsquedas (opcional, solo si hay muchas consultas)
CREATE INDEX IF NOT EXISTS idx_users_google_drive_url ON users(google_drive_folder_url) 
WHERE google_drive_folder_url IS NOT NULL;

-- 4. Verificar que la columna se creó correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'google_drive_folder_url';

-- ✅ Listo para usar
-- Ejemplo de uso:
-- UPDATE users 
-- SET google_drive_folder_url = 'https://drive.google.com/drive/folders/1_Dg8zUvjCAkGpOqa1ZngFyLx0XKT8lWf'
-- WHERE id = '0976437e-15e6-424d-8122-afb65580239a';





