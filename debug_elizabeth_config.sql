-- 🔍 ANÁLISIS ESPECÍFICO: Verificar configuración de Elizabeth
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar TODAS las configuraciones de Elizabeth (activas e inactivas)
SELECT 
    'TODAS LAS CONFIGURACIONES DE ELIZABETH' as info,
    id,
    model_id,
    group_percentage,
    percentage_override,
    group_min_quota,
    min_quota_override,
    active,
    created_at,
    updated_at
FROM calculator_config 
WHERE model_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7' 
ORDER BY created_at DESC;

-- 2. Verificar si hay configuraciones duplicadas o conflictivas
SELECT 
    'CONFIGURACIONES CONFLICTIVAS' as info,
    model_id,
    COUNT(*) as total_configs,
    COUNT(CASE WHEN active = true THEN 1 END) as active_configs,
    COUNT(CASE WHEN active = false THEN 1 END) as inactive_configs,
    MAX(created_at) as latest_config,
    MIN(created_at) as oldest_config
FROM calculator_config 
WHERE model_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7'
GROUP BY model_id;

-- 3. Verificar la configuración que está siendo usada actualmente
SELECT 
    'CONFIGURACIÓN ACTIVA ACTUAL' as info,
    *
FROM calculator_config 
WHERE model_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7' 
AND active = true
ORDER BY created_at DESC 
LIMIT 1;

-- 4. Verificar si hay configuraciones con group_percentage = 60
SELECT 
    'CONFIGURACIONES CON 60%' as info,
    *
FROM calculator_config 
WHERE model_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7' 
AND group_percentage = 60;

-- 5. Verificar si hay configuraciones con group_percentage = 80
SELECT 
    'CONFIGURACIONES CON 80%' as info,
    *
FROM calculator_config 
WHERE model_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7' 
AND group_percentage = 80;

-- 6. Verificar si hay configuraciones con group_percentage NULL
SELECT 
    'CONFIGURACIONES CON NULL' as info,
    *
FROM calculator_config 
WHERE model_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7' 
AND group_percentage IS NULL;
