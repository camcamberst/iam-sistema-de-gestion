-- 🔍 VERIFICACIÓN FINAL: Confirmar que no quedan problemas
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar que no quedan configuraciones con group_percentage NULL
SELECT 
    'VERIFICACIÓN FINAL - NULL' as info,
    COUNT(*) as remaining_null_configs
FROM calculator_config 
WHERE group_percentage IS NULL;

-- 2. Verificar que no quedan configuraciones con group_percentage = 0
SELECT 
    'VERIFICACIÓN FINAL - ZERO' as info,
    COUNT(*) as remaining_zero_configs
FROM calculator_config 
WHERE group_percentage = 0;

-- 3. Resumen final de todas las configuraciones
SELECT 
    'RESUMEN FINAL' as info,
    COUNT(*) as total_configs,
    COUNT(CASE WHEN group_percentage IS NULL THEN 1 END) as null_percentage,
    COUNT(CASE WHEN group_percentage = 0 THEN 1 END) as zero_percentage,
    COUNT(CASE WHEN group_percentage = 60 THEN 1 END) as sixty_percentage,
    COUNT(CASE WHEN group_percentage = 80 THEN 1 END) as eighty_percentage,
    COUNT(CASE WHEN active = true THEN 1 END) as active_configs
FROM calculator_config;

-- 4. Listar todas las configuraciones activas para verificación
SELECT 
    'CONFIGURACIONES ACTIVAS FINALES' as info,
    id,
    model_id,
    group_percentage,
    percentage_override,
    active,
    created_at
FROM calculator_config 
WHERE active = true
ORDER BY created_at DESC;

