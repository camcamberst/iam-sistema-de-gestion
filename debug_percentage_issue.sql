-- =====================================================
-- 🔍 DEBUG: Problema de porcentajes 60% vs 80%
-- =====================================================

-- 1. Verificar configuración de Elizabeth Pineda Mora
SELECT 
  'Configuración de Elizabeth' as info,
  model_id,
  percentage_override,
  group_percentage,
  active,
  created_at
FROM calculator_config 
WHERE model_id = (
  SELECT id FROM users 
  WHERE email = 'maiteflores@tuemailya.com' 
  LIMIT 1
)
ORDER BY created_at DESC;

-- 2. Verificar si hay configuración activa
SELECT 
  'Configuraciones activas' as info,
  COUNT(*) as total,
  COUNT(CASE WHEN percentage_override IS NOT NULL THEN 1 END) as con_override,
  COUNT(CASE WHEN percentage_override IS NULL THEN 1 END) as sin_override
FROM calculator_config 
WHERE active = true;

-- 3. Verificar valores específicos de group_percentage
SELECT 
  'Valores de group_percentage' as info,
  group_percentage,
  COUNT(*) as cantidad
FROM calculator_config 
WHERE active = true
GROUP BY group_percentage
ORDER BY group_percentage;

-- 4. Verificar configuración más reciente
SELECT 
  'Configuración más reciente' as info,
  model_id,
  percentage_override,
  group_percentage,
  created_at
FROM calculator_config 
WHERE active = true
ORDER BY created_at DESC
LIMIT 5;
