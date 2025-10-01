-- =====================================================
-- 🔍 VERIFICAR ESTRUCTURA ACTUAL DE MODEL_VALUES
-- =====================================================

-- 1. Verificar estructura de la tabla model_values
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'model_values' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar si hay datos en la tabla
SELECT COUNT(*) as total_records FROM model_values;

-- 3. Verificar datos existentes (últimos 5 registros)
SELECT * FROM model_values ORDER BY created_at DESC LIMIT 5;
