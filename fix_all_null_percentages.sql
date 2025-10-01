-- 🔧 CORREGIR TODAS LAS CONFIGURACIONES CON group_percentage NULL
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar cuántas configuraciones tienen group_percentage NULL
SELECT 
    'CONFIGURACIONES CON NULL' as info,
    COUNT(*) as total_configs,
    COUNT(CASE WHEN active = true THEN 1 END) as active_configs
FROM calculator_config 
WHERE group_percentage IS NULL;

-- 2. Actualizar TODAS las configuraciones con group_percentage NULL a 80 (valor por defecto)
UPDATE calculator_config 
SET 
    group_percentage = 80,
    updated_at = NOW()
WHERE group_percentage IS NULL;

-- 3. Verificar que se actualizaron correctamente
SELECT 
    'CONFIGURACIONES ACTUALIZADAS' as info,
    COUNT(*) as total_configs,
    COUNT(CASE WHEN active = true THEN 1 END) as active_configs
FROM calculator_config 
WHERE group_percentage = 80;

-- 4. Verificar que no quedan configuraciones con NULL
SELECT 
    'VERIFICACIÓN FINAL' as info,
    COUNT(*) as remaining_null_configs
FROM calculator_config 
WHERE group_percentage IS NULL;
