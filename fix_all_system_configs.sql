-- 🔧 CORRECCIÓN SISTÉMICA: Corregir TODAS las configuraciones con problemas
-- Ejecutar en Supabase SQL Editor

-- 1. VERIFICAR ESTADO ACTUAL DEL SISTEMA
SELECT 
    'ESTADO ACTUAL DEL SISTEMA' as info,
    COUNT(*) as total_configs,
    COUNT(CASE WHEN group_percentage IS NULL THEN 1 END) as null_percentage,
    COUNT(CASE WHEN group_percentage = 0 THEN 1 END) as zero_percentage,
    COUNT(CASE WHEN group_percentage = 60 THEN 1 END) as sixty_percentage,
    COUNT(CASE WHEN group_percentage = 80 THEN 1 END) as eighty_percentage,
    COUNT(CASE WHEN active = true THEN 1 END) as active_configs
FROM calculator_config;

-- 2. CORREGIR TODAS LAS CONFIGURACIONES CON group_percentage NULL
-- Establecer a 80% (valor por defecto del sistema)
UPDATE calculator_config 
SET 
    group_percentage = 80,
    updated_at = NOW()
WHERE group_percentage IS NULL;

-- 3. CORREGIR TODAS LAS CONFIGURACIONES CON group_percentage = 0
-- Establecer a 80% (valor por defecto del sistema)
UPDATE calculator_config 
SET 
    group_percentage = 80,
    updated_at = NOW()
WHERE group_percentage = 0;

-- 4. VERIFICAR QUE SE CORRIGIERON TODAS LAS CONFIGURACIONES
SELECT 
    'VERIFICACIÓN POST-CORRECCIÓN' as info,
    COUNT(*) as total_configs,
    COUNT(CASE WHEN group_percentage IS NULL THEN 1 END) as remaining_null,
    COUNT(CASE WHEN group_percentage = 0 THEN 1 END) as remaining_zero,
    COUNT(CASE WHEN group_percentage = 60 THEN 1 END) as sixty_percentage,
    COUNT(CASE WHEN group_percentage = 80 THEN 1 END) as eighty_percentage,
    COUNT(CASE WHEN active = true THEN 1 END) as active_configs
FROM calculator_config;

-- 5. LISTAR TODAS LAS CONFIGURACIONES ACTIVAS PARA VERIFICACIÓN
SELECT 
    'CONFIGURACIONES ACTIVAS FINALES' as info,
    id,
    model_id,
    group_percentage,
    percentage_override,
    active,
    created_at,
    updated_at
FROM calculator_config 
WHERE active = true
ORDER BY created_at DESC;

-- 6. VERIFICAR QUE NO QUEDAN PROBLEMAS
SELECT 
    'VERIFICACIÓN FINAL - SIN PROBLEMAS' as info,
    CASE 
        WHEN COUNT(CASE WHEN group_percentage IS NULL THEN 1 END) = 0 
        AND COUNT(CASE WHEN group_percentage = 0 THEN 1 END) = 0 
        THEN '✅ SISTEMA CORREGIDO - SIN PROBLEMAS'
        ELSE '❌ AÚN HAY PROBLEMAS - REVISAR'
    END as status,
    COUNT(CASE WHEN group_percentage IS NULL THEN 1 END) as remaining_null,
    COUNT(CASE WHEN group_percentage = 0 THEN 1 END) as remaining_zero
FROM calculator_config;

