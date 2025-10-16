-- =====================================================
-- 🔍 INVESTIGAR RESTRICCIÓN DE PERIOD_TYPE
-- =====================================================
-- Script SQL para verificar exactamente qué valores están permitidos
-- =====================================================

-- 1. Verificar restricciones de la tabla calculator_history
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conrelid = 'calculator_history'::regclass
AND contype = 'c';

-- 2. Verificar valores existentes en period_type
SELECT 
    'VALORES EXISTENTES EN PERIOD_TYPE' AS info,
    period_type,
    COUNT(*) AS cantidad_registros
FROM calculator_history 
GROUP BY period_type
ORDER BY period_type;

-- 3. Verificar estructura de la tabla calculator_history
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'calculator_history'
ORDER BY ordinal_position;

-- 4. Intentar insertar un registro de prueba con diferentes valores
-- (Esto nos ayudará a identificar qué valores son válidos)

-- Probar con NULL
INSERT INTO calculator_history (
    model_id,
    platform_id,
    value,
    period_date,
    period_type,
    archived_at,
    original_updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    0.00,
    '2025-10-16'::date,
    NULL,
    NOW(),
    NOW()
);

-- Si funciona, eliminar el registro de prueba
DELETE FROM calculator_history 
WHERE model_id = '00000000-0000-0000-0000-000000000000'::uuid;

-- =====================================================
-- 🔍 DIAGNÓSTICO:
-- =====================================================
-- Después de ejecutar este script, sabremos:
-- 1. Qué valores están permitidos en period_type
-- 2. Si NULL es un valor válido
-- 3. Cuáles son los valores existentes en la tabla
-- =====================================================
