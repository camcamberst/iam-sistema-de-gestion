-- =====================================================
-- 🔍 VERIFICACIÓN PROFUNDA DE BASE DE DATOS
-- =====================================================

-- 1. Verificar si existen las tablas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('calculator_config', 'calculator_platforms', 'users', 'user_groups', 'groups')
ORDER BY table_name;

-- 2. Verificar datos en calculator_platforms
SELECT COUNT(*) as total_platforms FROM calculator_platforms;
SELECT id, name, currency, active FROM calculator_platforms LIMIT 10;

-- 3. Verificar datos en calculator_config
SELECT COUNT(*) as total_configs FROM calculator_config;
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

-- 4. Verificar usuarios
SELECT COUNT(*) as total_users FROM users;
SELECT id, email, name, role FROM users LIMIT 10;

-- 5. Verificar grupos
SELECT COUNT(*) as total_groups FROM groups;
SELECT id, name FROM groups LIMIT 10;

-- 6. Verificar user_groups
SELECT COUNT(*) as total_user_groups FROM user_groups;
SELECT user_id, group_id FROM user_groups LIMIT 10;

-- 7. Verificar configuración específica para modelo
-- (Reemplazar 'MODEL_ID_AQUI' con el ID real de la modelo)
SELECT 
  cc.*,
  u_model.email as model_email,
  u_admin.email as admin_email
FROM calculator_config cc
LEFT JOIN users u_model ON cc.model_id = u_model.id
LEFT JOIN users u_admin ON cc.admin_id = u_admin.id
WHERE cc.model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56' -- ID de la modelo
AND cc.active = true;
