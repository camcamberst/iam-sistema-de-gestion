-- Script para verificar qué tablas de anticipos existen realmente

-- 1. Verificar todas las tablas que contienen 'anticipo' en el nombre
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name LIKE '%anticipo%'
ORDER BY table_name;

-- 2. Verificar todas las tablas que contienen 'advance' en el nombre (por si está en inglés)
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name LIKE '%advance%'
ORDER BY table_name;

-- 3. Verificar todas las tablas que contienen 'loan' en el nombre (por si está como préstamo)
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name LIKE '%loan%'
ORDER BY table_name;

-- 4. Listar TODAS las tablas del esquema público para buscar manualmente
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
