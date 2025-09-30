-- =====================================================
-- 🔍 DEBUG COMPLETO DEL FLUJO DE CALCULADORA
-- =====================================================

-- 1. Ver la configuración guardada
SELECT 
  id, 
  model_id, 
  admin_id, 
  enabled_platforms,
  percentage_override,
  min_quota_override,
  group_percentage,
  group_min_quota,
  active,
  created_at
FROM calculator_config 
ORDER BY created_at DESC;

-- 2. Ver qué plataformas están habilitadas (JSON)
SELECT 
  model_id,
  enabled_platforms,
  jsonb_array_length(enabled_platforms) as platform_count
FROM calculator_config 
WHERE active = true;

-- 3. Ver todas las plataformas disponibles
SELECT id, name, currency, active 
FROM calculator_platforms 
ORDER BY name;

-- 4. Ver usuarios para identificar modelo y admin
SELECT id, email, name, role 
FROM users 
ORDER BY role, name;

-- 5. Verificar si hay datos en model_values
SELECT COUNT(*) as model_values_count FROM model_values;
