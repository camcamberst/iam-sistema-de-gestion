-- =====================================================
-- 🔍 VERIFICAR TABLAS EN SUPABASE
-- =====================================================

-- 1. Verificar si existe calculator_config
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_config' AND table_schema = 'public') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as calculator_config_status;

-- 2. Verificar si existe calculator_platforms
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_platforms' AND table_schema = 'public') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as calculator_platforms_status;

-- 3. Verificar si existe users
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') 
    THEN 'EXISTS' 
    ELSE 'NOT EXISTS' 
  END as users_status;

-- 4. Verificar datos en calculator_config
SELECT COUNT(*) as calculator_config_count FROM calculator_config;

-- 5. Verificar datos en calculator_platforms
SELECT COUNT(*) as calculator_platforms_count FROM calculator_platforms;

-- 6. Verificar datos en users
SELECT COUNT(*) as users_count FROM users;

-- 7. Verificar estructura de calculator_config
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'calculator_config' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 8. Verificar estructura de calculator_platforms
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'calculator_platforms' 
AND table_schema = 'public'
ORDER BY ordinal_position;
