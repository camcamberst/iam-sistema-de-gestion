-- =====================================================
-- 🔍 BUSCAR DÓNDE ESTÁN LAS PLATAFORMAS EN LA BD
-- =====================================================

-- 1. Buscar TODAS las tablas que contengan "platform" en el nombre
SELECT 
  table_name,
  table_type,
  'TABLA ENCONTRADA' as estado
FROM information_schema.tables 
WHERE table_name ILIKE '%platform%'
ORDER BY table_name;

-- 2. Buscar tablas que contengan "calculator" en el nombre
SELECT 
  table_name,
  table_type,
  'TABLA CALCULATOR' as estado
FROM information_schema.tables 
WHERE table_name ILIKE '%calculator%'
ORDER BY table_name;

-- 3. Buscar tablas que contengan "config" en el nombre
SELECT 
  table_name,
  table_type,
  'TABLA CONFIG' as estado
FROM information_schema.tables 
WHERE table_name ILIKE '%config%'
ORDER BY table_name;

-- 4. Ver TODAS las tablas del esquema public
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 5. Si existe calculator_platforms, ver su contenido
SELECT 
  'calculator_platforms' as tabla,
  COUNT(*) as total_registros,
  'ACTIVA' as estado
FROM calculator_platforms
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calculator_platforms');

-- 6. Si existe platforms, ver su contenido
SELECT 
  'platforms' as tabla,
  COUNT(*) as total_registros,
  'ACTIVA' as estado
FROM platforms
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platforms');

-- 7. Buscar columnas que contengan "platform" en cualquier tabla
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE column_name ILIKE '%platform%'
ORDER BY table_name, column_name;

-- 8. Ver si hay datos en tablas relacionadas con calculadora
SELECT 
  'users' as tabla,
  COUNT(*) as total,
  'Usuarios del sistema' as descripcion
FROM users
UNION ALL
SELECT 
  'calculator_config' as tabla,
  COUNT(*) as total,
  'Configuraciones de calculadora' as descripcion
FROM calculator_config
UNION ALL
SELECT 
  'model_values' as tabla,
  COUNT(*) as total,
  'Valores de modelos' as descripcion
FROM model_values
UNION ALL
SELECT 
  'rates' as tabla,
  COUNT(*) as total,
  'Tasas de cambio' as descripcion
FROM rates;

