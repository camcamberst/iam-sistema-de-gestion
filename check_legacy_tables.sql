-- =====================================================
-- 🔍 VERIFICAR SISTEMA ANTIGUO vs NUEVO
-- =====================================================

-- 1. Verificar si existe la tabla calculator_config
SELECT 
  'Tabla calculator_config existe' as info,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_config') 
    THEN 'SÍ' 
    ELSE 'NO' 
  END as existe;

-- 2. Verificar si existe la tabla calculator_platforms
SELECT 
  'Tabla calculator_platforms existe' as info,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_platforms') 
    THEN 'SÍ' 
    ELSE 'NO' 
  END as existe;

-- 3. Si existen, verificar datos en calculator_config
SELECT 
  'Datos en calculator_config' as info,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN active = true THEN 1 END) as activos
FROM calculator_config;

-- 4. Verificar estructura de calculator_config
SELECT 
  'Estructura calculator_config' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'calculator_config'
ORDER BY ordinal_position;

-- 5. Verificar si hay configuraciones para modelos específicas
SELECT 
  'Configuraciones por modelo' as info,
  model_id,
  active,
  created_at
FROM calculator_config 
ORDER BY created_at DESC
LIMIT 10;

-- 6. Verificar si hay plataformas habilitadas
SELECT 
  'Plataformas habilitadas' as info,
  COUNT(*) as total_plataformas,
  COUNT(CASE WHEN enabled = true THEN 1 END) as habilitadas
FROM calculator_platforms;
