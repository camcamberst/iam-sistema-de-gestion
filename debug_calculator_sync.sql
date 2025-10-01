-- =====================================================
-- 🔍 DEBUG: Sincronización Calculadora Admin-Modelo
-- =====================================================
-- Este script verifica la configuración de calculadora
-- para entender por qué el admin no ve las plataformas

-- 1. Verificar configuración de calculadora para una modelo específica
SELECT 
  'Configuración de calculadora' as info,
  model_id,
  active,
  created_at,
  updated_at
FROM calculator_config 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'  -- Reemplazar con ID de modelo real
ORDER BY created_at DESC;

-- 2. Verificar plataformas habilitadas para esa modelo
SELECT 
  'Plataformas habilitadas' as info,
  COUNT(*) as cantidad_plataformas
FROM calculator_platforms cp
JOIN calculator_config cc ON cp.config_id = cc.id
WHERE cc.model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'  -- Reemplazar con ID de modelo real
  AND cc.active = true
  AND cp.enabled = true;

-- 3. Verificar si hay configuración activa
SELECT 
  'Configuración activa' as info,
  COUNT(*) as configuraciones_activas
FROM calculator_config 
WHERE active = true;

-- 4. Verificar todas las configuraciones de calculadora
SELECT 
  'Todas las configuraciones' as info,
  model_id,
  active,
  created_at
FROM calculator_config 
ORDER BY created_at DESC
LIMIT 10;

-- 5. Verificar usuarios con rol modelo
SELECT 
  'Usuarios modelo' as info,
  id,
  name,
  email,
  role
FROM users 
WHERE role = 'modelo'
ORDER BY created_at DESC
LIMIT 5;
