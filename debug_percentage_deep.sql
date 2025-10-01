-- 🔍 ANÁLISIS PROFUNDO: Verificar porcentajes en base de datos
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar configuración de Elizabeth
SELECT 
    'CONFIGURACIÓN DE ELIZABETH' as info,
    model_id,
    group_percentage,
    percentage_override,
    group_min_quota,
    min_quota_override,
    created_at,
    active
FROM calculator_config 
WHERE model_id = 'elizabeth-id' 
ORDER BY created_at DESC;

-- 2. Verificar todas las configuraciones activas
SELECT 
    'TODAS LAS CONFIGURACIONES ACTIVAS' as info,
    model_id,
    group_percentage,
    percentage_override,
    created_at
FROM calculator_config 
WHERE active = true 
ORDER BY created_at DESC;

-- 3. Verificar si hay múltiples configuraciones para Elizabeth
SELECT 
    'MÚLTIPLES CONFIGURACIONES ELIZABETH' as info,
    COUNT(*) as total_configs,
    MAX(created_at) as latest_config,
    MIN(created_at) as oldest_config
FROM calculator_config 
WHERE model_id = 'elizabeth-id';

-- 4. Verificar la configuración más reciente de Elizabeth
SELECT 
    'CONFIGURACIÓN MÁS RECIENTE ELIZABETH' as info,
    *
FROM calculator_config 
WHERE model_id = 'elizabeth-id' 
ORDER BY created_at DESC 
LIMIT 1;

-- 5. Verificar si hay configuraciones inactivas que puedan estar interfiriendo
SELECT 
    'CONFIGURACIONES INACTIVAS ELIZABETH' as info,
    model_id,
    group_percentage,
    percentage_override,
    active,
    created_at
FROM calculator_config 
WHERE model_id = 'elizabeth-id' 
AND active = false
ORDER BY created_at DESC;
