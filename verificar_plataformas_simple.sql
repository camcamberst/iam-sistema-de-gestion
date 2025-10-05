-- =====================================================
-- 🔍 VERIFICAR PLATAFORMAS - SCRIPT SEGURO
-- =====================================================

-- 1. Verificar tablas existentes que contengan "platform"
SELECT 
  table_name,
  'EXISTE' as estado
FROM information_schema.tables 
WHERE table_name ILIKE '%platform%'
ORDER BY table_name;

-- 2. Verificar si calculator_platforms existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_platforms') 
    THEN '✅ calculator_platforms EXISTE'
    ELSE '❌ calculator_platforms NO EXISTE'
  END as estado_calculator_platforms;

-- 3. Si calculator_platforms existe, ver su contenido
SELECT 
  'calculator_platforms' as tabla,
  COUNT(*) as total_registros
FROM calculator_platforms
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_platforms');

-- 4. Ver las primeras 5 plataformas (si existen)
SELECT 
  id, 
  name, 
  currency, 
  active
FROM calculator_platforms 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_platforms')
ORDER BY name
LIMIT 5;

-- 5. Verificar estructura de calculator_platforms
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'calculator_platforms'
ORDER BY ordinal_position;

-- 6. Verificar RLS en calculator_platforms
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE tablename = 'calculator_platforms';

-- 7. Verificar otras tablas relacionadas
SELECT 
  'users' as tabla,
  COUNT(*) as total
FROM users
UNION ALL
SELECT 
  'calculator_config' as tabla,
  COUNT(*) as total
FROM calculator_config
UNION ALL
SELECT 
  'model_values' as tabla,
  COUNT(*) as total
FROM model_values;

