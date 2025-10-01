-- 🔍 VERIFICAR TODAS LAS CONFIGURACIONES CON PROBLEMAS
-- Ejecutar en Supabase SQL Editor

-- 1. Buscar TODAS las configuraciones con group_percentage NULL
SELECT 
    'CONFIGURACIONES CON NULL' as info,
    COUNT(*) as total_configs,
    COUNT(CASE WHEN active = true THEN 1 END) as active_configs,
    COUNT(CASE WHEN active = false THEN 1 END) as inactive_configs
FROM calculator_config 
WHERE group_percentage IS NULL;

-- 2. Listar todas las configuraciones con group_percentage NULL
SELECT 
    'DETALLE CONFIGURACIONES NULL' as info,
    id,
    model_id,
    group_percentage,
    percentage_override,
    active,
    created_at
FROM calculator_config 
WHERE group_percentage IS NULL
ORDER BY created_at DESC;

-- 3. Buscar configuraciones con group_percentage = 0
SELECT 
    'CONFIGURACIONES CON 0' as info,
    COUNT(*) as total_configs,
    COUNT(CASE WHEN active = true THEN 1 END) as active_configs
FROM calculator_config 
WHERE group_percentage = 0;

-- 4. Listar configuraciones con group_percentage = 0
SELECT 
    'DETALLE CONFIGURACIONES 0' as info,
    id,
    model_id,
    group_percentage,
    percentage_override,
    active,
    created_at
FROM calculator_config 
WHERE group_percentage = 0
ORDER BY created_at DESC;

-- 5. Resumen de todas las configuraciones
SELECT 
    'RESUMEN GENERAL' as info,
    COUNT(*) as total_configs,
    COUNT(CASE WHEN group_percentage IS NULL THEN 1 END) as null_percentage,
    COUNT(CASE WHEN group_percentage = 0 THEN 1 END) as zero_percentage,
    COUNT(CASE WHEN group_percentage = 60 THEN 1 END) as sixty_percentage,
    COUNT(CASE WHEN group_percentage = 80 THEN 1 END) as eighty_percentage,
    COUNT(CASE WHEN active = true THEN 1 END) as active_configs
FROM calculator_config;
