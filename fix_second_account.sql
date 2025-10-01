-- 🔧 CORREGIR SEGUNDA CUENTA CON PROBLEMA
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar la configuración actual de la segunda cuenta
SELECT 
    'CONFIGURACIÓN ACTUAL SEGUNDA CUENTA' as info,
    id,
    model_id,
    group_percentage,
    percentage_override,
    active,
    created_at
FROM calculator_config 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56' 
AND active = true;

-- 2. Actualizar group_percentage a 80 (valor por defecto del grupo)
UPDATE calculator_config 
SET 
    group_percentage = 80,
    updated_at = NOW()
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56' 
AND active = true;

-- 3. Verificar que se actualizó correctamente
SELECT 
    'CONFIGURACIÓN ACTUALIZADA SEGUNDA CUENTA' as info,
    id,
    model_id,
    group_percentage,
    percentage_override,
    active,
    updated_at
FROM calculator_config 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56' 
AND active = true;

