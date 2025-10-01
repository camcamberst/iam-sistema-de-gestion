-- 🔍 DIAGNÓSTICO: VERIFICAR CONFIGURACIÓN DE PLATAFORMAS PARA ADMIN
-- Problema: Admin no ve plataformas de la modelo

-- 1. Verificar configuración de calculadora para la modelo
SELECT 
  'calculator_config' as tabla,
  model_id,
  active,
  created_at,
  updated_at
FROM calculator_config 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'  -- ID de la modelo
ORDER BY created_at DESC;

-- 2. Verificar plataformas habilitadas para la modelo
SELECT 
  'platforms_enabled' as tipo,
  COUNT(*) as total_platforms,
  STRING_AGG(platform_id, ', ') as plataformas
FROM calculator_config 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND active = true;

-- 3. Verificar si hay configuración activa
SELECT 
  'config_status' as analisis,
  CASE 
    WHEN COUNT(*) > 0 THEN 'CONFIGURACIÓN EXISTE'
    ELSE 'NO HAY CONFIGURACIÓN'
  END as estado,
  COUNT(*) as total_configs
FROM calculator_config 
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND active = true;

-- 4. Verificar permisos RLS para admin
SELECT 
  'rls_policies' as tipo,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'calculator_config';

-- 5. Verificar si el admin puede ver la configuración
-- (Esto se verifica en la consola del navegador del admin)
