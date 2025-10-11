-- Script para verificar la estructura real de la tabla 'anticipos'

-- 1. Ver la estructura completa de la tabla 'anticipos'
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'anticipos'
ORDER BY ordinal_position;

-- 2. Ver todos los datos de la tabla 'anticipos' (sin especificar columnas)
SELECT * FROM anticipos;

-- 3. Contar registros
SELECT COUNT(*) as total_registros FROM anticipos;