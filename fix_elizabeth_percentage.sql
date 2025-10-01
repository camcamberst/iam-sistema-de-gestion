-- 🔧 CORREGIR CONFIGURACIÓN DE ELIZABETH
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar la configuración actual
SELECT 
    'CONFIGURACIÓN ACTUAL' as info,
    id,
    model_id,
    group_percentage,
    percentage_override,
    active,
    created_at
FROM calculator_config 
WHERE model_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7' 
AND active = true;

-- 2. Actualizar group_percentage a 60
UPDATE calculator_config 
SET 
    group_percentage = 60,
    updated_at = NOW()
WHERE model_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7' 
AND active = true;

-- 3. Verificar que se actualizó correctamente
SELECT 
    'CONFIGURACIÓN ACTUALIZADA' as info,
    id,
    model_id,
    group_percentage,
    percentage_override,
    active,
    updated_at
FROM calculator_config 
WHERE model_id = 'c8a156fb-1a56-4160-a63d-679c36bda1e7' 
AND active = true;
