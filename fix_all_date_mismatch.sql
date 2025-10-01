-- 🔧 SOLUCIÓN SISTÉMICA: CORREGIR DIFERENCIA DE FECHAS PARA TODAS LAS MODELOS
-- Problema: Valores guardados con fecha Colombia no se muestran con fecha Europa Central

-- 1. DIAGNÓSTICO: Verificar cuántos valores están afectados
SELECT 
  'Valores con fecha Colombia' as tipo,
  COUNT(*) as total_valores,
  COUNT(DISTINCT model_id) as modelos_afectadas,
  MIN(period_date) as fecha_minima,
  MAX(period_date) as fecha_maxima
FROM model_values 
WHERE period_date = (NOW() AT TIME ZONE 'America/Bogota')::date;

-- 2. SOLUCIÓN: Actualizar period_date de Colombia a Europa Central para TODAS las modelos
UPDATE model_values 
SET period_date = (NOW() AT TIME ZONE 'Europe/Berlin')::date  -- Fecha Europa Central
WHERE period_date = (NOW() AT TIME ZONE 'America/Bogota')::date;  -- Fecha Colombia

-- 3. VERIFICACIÓN: Confirmar que se actualizaron correctamente
SELECT 
  'Después de corrección' as estado,
  COUNT(*) as total_valores,
  COUNT(DISTINCT model_id) as modelos_afectadas,
  STRING_AGG(DISTINCT model_id::text, ', ') as modelos_corregidas
FROM model_values 
WHERE period_date = (NOW() AT TIME ZONE 'Europe/Berlin')::date;

-- 4. VERIFICAR QUE NO QUEDEN VALORES CON FECHA COLOMBIA
SELECT 
  'Valores restantes con fecha Colombia' as tipo,
  COUNT(*) as cantidad
FROM model_values 
WHERE period_date = (NOW() AT TIME ZONE 'America/Bogota')::date;

-- 5. ESTADÍSTICAS FINALES
SELECT 
  'Resumen final' as analisis,
  COUNT(*) as total_valores,
  COUNT(DISTINCT model_id) as total_modelos,
  STRING_AGG(DISTINCT period_date::text, ', ') as fechas_activas
FROM model_values;
