-- 🔍 VERIFICAR ESTRUCTURA DE LA TABLA model_values
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar si la tabla existe
SELECT 
    table_name, 
    table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'model_values';

-- 2. Verificar estructura de la tabla
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'model_values'
ORDER BY ordinal_position;

-- 3. Verificar índices y constraints
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'model_values';

-- 4. Verificar datos existentes
SELECT 
    model_id, 
    platform_id, 
    value, 
    period_date, 
    updated_at
FROM public.model_values 
ORDER BY updated_at DESC 
LIMIT 10;

-- 5. Verificar si hay datos para una modelo específica
-- (Reemplazar 'TU_MODEL_ID' con el ID real)
SELECT 
    COUNT(*) as total_records,
    MIN(period_date) as min_date,
    MAX(period_date) as max_date
FROM public.model_values 
WHERE model_id = 'TU_MODEL_ID';
