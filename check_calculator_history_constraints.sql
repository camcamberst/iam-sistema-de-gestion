-- =====================================================
-- 🔍 VERIFICAR RESTRICCIONES DE CALCULATOR_HISTORY
-- =====================================================
-- Script SQL para verificar qué valores están permitidos en period_type
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
