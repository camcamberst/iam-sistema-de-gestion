-- Agregar columna groups a la tabla users
-- Esta columna almacenará un array de IDs de grupos

-- 1. Agregar la columna groups como array de UUIDs
ALTER TABLE users 
ADD COLUMN groups UUID[] DEFAULT '{}';

-- 2. Crear índice para mejorar performance
CREATE INDEX idx_users_groups ON users USING GIN (groups);

-- 3. Verificar que la columna se creó correctamente
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'groups';

-- 4. Mostrar algunos usuarios para verificar
SELECT id, name, email, role, groups 
FROM users 
WHERE role = 'modelo' 
LIMIT 3;
