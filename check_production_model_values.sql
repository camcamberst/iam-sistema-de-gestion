-- 🔍 VERIFICAR ESTADO REAL DE MODEL_VALUES EN PRODUCCIÓN
-- Este script verifica el estado actual de la tabla model_values en Supabase

-- 1. Verificar estructura de la tabla
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'model_values' 
ORDER BY ordinal_position;

-- 2. Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'model_values';

-- 3. Verificar datos recientes (últimas 24 horas)
SELECT 
    model_id,
    platform_id,
    value,
    period_date,
    created_at,
    updated_at
FROM model_values 
WHERE created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Verificar duplicados por modelo y plataforma
SELECT 
    model_id,
    platform_id,
    period_date,
    COUNT(*) as count,
    array_agg(id) as ids,
    array_agg(value) as values,
    array_agg(created_at) as created_times
FROM model_values 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY model_id, platform_id, period_date
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 5. Verificar valores para modelo específico (última semana)
SELECT 
    model_id,
    platform_id,
    value,
    period_date,
    created_at,
    updated_at
FROM model_values 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- 6. Verificar si hay valores con period_date incorrecto
SELECT 
    period_date,
    COUNT(*) as count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM model_values 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY period_date
ORDER BY period_date DESC;

-- 7. Verificar logs de auditoría (si está habilitada)
SELECT 
    event_type,
    table_name,
    old_values,
    new_values,
    created_at
FROM audit_log 
WHERE table_name = 'model_values'
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 10;
