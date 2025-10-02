-- 🔍 ANÁLISIS: Lógica de funcionamiento de Mi Calculadora
-- 
-- Este script analiza cómo debería funcionar "Mi Calculadora" basado
-- en la estructura real de Supabase

-- 1. VERIFICAR CONFIGURACIÓN DE UN MODELO ESPECÍFICO
-- (Reemplaza 'MODEL_ID_AQUI' con el ID real del modelo)
SELECT 
  cc.model_id,
  cc.admin_id,
  cc.enabled_platforms,
  cc.percentage_override,
  cc.group_percentage,
  cc.active,
  cc.created_at,
  cc.updated_at
FROM calculator_config cc
WHERE cc.model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND cc.active = true
ORDER BY cc.updated_at DESC;

-- 2. VERIFICAR PLATAFORMAS HABILITADAS PARA EL MODELO
SELECT 
  cp.id,
  cp.name,
  cp.currency,
  cp.token_rate,
  cp.discount_factor,
  cp.active
FROM calculator_platforms cp
WHERE cp.id = ANY(
  SELECT jsonb_array_elements_text(cc.enabled_platforms)::text
  FROM calculator_config cc
  WHERE cc.model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
    AND cc.active = true
)
ORDER BY cp.name;

-- 3. VERIFICAR VALORES ACTUALES DEL MODELO (HOY)
SELECT 
  mv.model_id,
  mv.platform_id,
  cp.name as platform_name,
  mv.value,
  mv.period_date,
  mv.updated_at
FROM model_values mv
JOIN calculator_platforms cp ON mv.platform_id = cp.id
WHERE mv.model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND mv.period_date = CURRENT_DATE
ORDER BY cp.name;

-- 4. VERIFICAR HISTORIAL DE VALORES DEL MODELO
SELECT 
  mv.model_id,
  mv.platform_id,
  cp.name as platform_name,
  mv.value,
  mv.period_date,
  mv.updated_at
FROM model_values mv
JOIN calculator_platforms cp ON mv.platform_id = cp.id
WHERE mv.model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
ORDER BY mv.updated_at DESC
LIMIT 20;

-- 5. VERIFICAR SI HAY CONFLICTOS DE UPSERT
SELECT 
  mv.model_id,
  mv.platform_id,
  cp.name as platform_name,
  mv.value,
  mv.period_date,
  mv.updated_at,
  COUNT(*) OVER (PARTITION BY mv.model_id, mv.platform_id, mv.period_date) as duplicate_count
FROM model_values mv
JOIN calculator_platforms cp ON mv.platform_id = cp.id
WHERE mv.model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND mv.period_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY mv.updated_at DESC;

-- 6. VERIFICAR LÓGICA DE PERÍODOS
SELECT 
  CURRENT_DATE as today,
  (CURRENT_DATE AT TIME ZONE 'Europe/Berlin')::date as europe_date,
  (CURRENT_DATE AT TIME ZONE 'America/Bogota')::date as colombia_date,
  CASE 
    WHEN EXTRACT(DAY FROM CURRENT_DATE) <= 15 THEN '1-15'
    ELSE '16-31'
  END as period_type;

-- 7. VERIFICAR TASAS DE CAMBIO ACTIVAS
SELECT 
  r.kind,
  r.value,
  r.valid_from,
  r.valid_to,
  r.active
FROM rates r
WHERE r.active = true
  AND (r.valid_to IS NULL OR r.valid_to > NOW())
ORDER BY r.valid_from DESC;

-- 8. SIMULAR CÁLCULO DE GANANCIAS
-- (Esto muestra cómo debería calcularse el total)
SELECT 
  mv.model_id,
  mv.platform_id,
  cp.name as platform_name,
  mv.value as input_value,
  cp.token_rate,
  cp.discount_factor,
  -- Cálculo simplificado (necesita lógica completa según fórmula)
  CASE 
    WHEN cp.currency = 'USD' THEN mv.value
    WHEN cp.currency = 'EUR' THEN mv.value * 1.01  -- EUR to USD
    WHEN cp.currency = 'GBP' THEN mv.value * 1.20  -- GBP to USD
    ELSE mv.value
  END as usd_value
FROM model_values mv
JOIN calculator_platforms cp ON mv.platform_id = cp.id
WHERE mv.model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND mv.period_date = CURRENT_DATE
  AND mv.value > 0
ORDER BY cp.name;

-- 9. VERIFICAR PROBLEMAS POTENCIALES
SELECT 
  'Valores duplicados' as issue_type,
  COUNT(*) as count
FROM (
  SELECT model_id, platform_id, period_date, COUNT(*)
  FROM model_values
  WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  GROUP BY model_id, platform_id, period_date
  HAVING COUNT(*) > 1
) duplicates

UNION ALL

SELECT 
  'Valores con fecha incorrecta' as issue_type,
  COUNT(*) as count
FROM model_values
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND period_date != CURRENT_DATE

UNION ALL

SELECT 
  'Configuración inactiva' as issue_type,
  COUNT(*) as count
FROM calculator_config
WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
  AND active = false;

-- 10. VERIFICAR FLUJO COMPLETO DE DATOS
SELECT 
  'Configuración' as step,
  CASE WHEN EXISTS(
    SELECT 1 FROM calculator_config 
    WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56' 
      AND active = true
  ) THEN 'OK' ELSE 'FALTA' END as status

UNION ALL

SELECT 
  'Plataformas habilitadas' as step,
  CASE WHEN EXISTS(
    SELECT 1 FROM calculator_config cc
    WHERE cc.model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56' 
      AND cc.active = true
      AND jsonb_array_length(cc.enabled_platforms) > 0
  ) THEN 'OK' ELSE 'FALTA' END as status

UNION ALL

SELECT 
  'Valores ingresados' as step,
  CASE WHEN EXISTS(
    SELECT 1 FROM model_values 
    WHERE model_id = 'fe54995d-1828-4721-8153-53fce6f4fe56'
      AND period_date = CURRENT_DATE
  ) THEN 'OK' ELSE 'FALTA' END as status;
