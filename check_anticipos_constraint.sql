-- Verificar constraint actual de la tabla anticipos
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.anticipos'::regclass 
AND contype = 'c'
AND conname LIKE '%estado%';
