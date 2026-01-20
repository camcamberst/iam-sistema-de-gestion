-- 🔧 FIX PASO A PASO: Ejecuta CADA consulta POR SEPARADO
-- NO ejecutes todo junto. Copia y pega CADA PASO individualmente.

-- ==========================================
-- PASO A: Ver duplicados actuales
-- ==========================================
-- EJECUTA ESTO PRIMERO para ver qué duplicados hay

SELECT 
  model_id,
  platform_id,
  period_date,
  COUNT(*) as cantidad_duplicados,
  STRING_AGG(id::text || ' (updated: ' || updated_at::text || ')', ', ' ORDER BY updated_at DESC) as ids_y_fechas
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31'
GROUP BY model_id, platform_id, period_date
HAVING COUNT(*) > 1
ORDER BY cantidad_duplicados DESC
LIMIT 20;

-- ==========================================
-- PASO B: Eliminar duplicados (MÉTODO SEGURO)
-- ==========================================
-- EJECUTA ESTO DESPUÉS DE VER LOS RESULTADOS DEL PASO A
-- Este método crea una lista de IDs a eliminar y los borra

-- Crear tabla temporal con IDs a conservar (los más recientes)
CREATE TEMP TABLE IF NOT EXISTS ids_a_conservar AS
SELECT DISTINCT ON (model_id, platform_id, period_date)
  id
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31'
ORDER BY model_id, platform_id, period_date, updated_at DESC;

-- Ver cuántos IDs vamos a conservar
SELECT 'IDs a conservar' as tipo, COUNT(*) as cantidad FROM ids_a_conservar;

-- Eliminar todos los que NO están en la lista de conservar
DELETE FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31'
  AND id NOT IN (SELECT id FROM ids_a_conservar);

-- Ver resultado
SELECT 
  'Duplicados eliminados' as resultado,
  COUNT(*) as registros_restantes,
  COUNT(DISTINCT model_id || platform_id || period_date) as combinaciones_unicas
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31';

-- Limpiar tabla temporal
DROP TABLE IF EXISTS ids_a_conservar;

-- ==========================================
-- PASO C: Verificar que no quedan duplicados
-- ==========================================
-- EJECUTA ESTO para confirmar que el PASO B funcionó

SELECT 
  model_id,
  platform_id,
  period_date,
  COUNT(*) as cantidad
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31'
GROUP BY model_id, platform_id, period_date
HAVING COUNT(*) > 1;

-- Si esta consulta devuelve 0 filas, ¡perfecto! No hay duplicados.
-- Si devuelve filas, vuelve a ejecutar el PASO B.

-- ==========================================
-- PASO D: Crear tabla temporal con valores normalizados
-- ==========================================
-- EJECUTA ESTO SOLO SI EL PASO C NO DEVOLVIÓ DUPLICADOS

CREATE TEMP TABLE IF NOT EXISTS valores_normalizados AS
SELECT 
  id,
  model_id,
  platform_id,
  value,
  updated_at,
  CASE 
    WHEN period_date <= '2026-01-15' THEN '2026-01-01'::date
    ELSE '2026-01-16'::date
  END as nueva_fecha
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31';

-- Ver qué se va a normalizar
SELECT 
  nueva_fecha,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  SUM(value) as suma_total
FROM valores_normalizados
GROUP BY nueva_fecha
ORDER BY nueva_fecha;

-- ==========================================
-- PASO E: Actualizar las fechas
-- ==========================================
-- EJECUTA ESTO para normalizar las fechas

UPDATE model_values
SET period_date = vn.nueva_fecha
FROM valores_normalizados vn
WHERE model_values.id = vn.id;

-- Ver resultado
SELECT 
  'Fechas actualizadas' as resultado,
  COUNT(*) as total
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31';

-- Limpiar tabla temporal
DROP TABLE IF EXISTS valores_normalizados;

-- ==========================================
-- PASO F: Eliminar duplicados creados por la normalización
-- ==========================================
-- EJECUTA ESTO para limpiar duplicados que se crearon al normalizar

-- Crear tabla con IDs a conservar
CREATE TEMP TABLE IF NOT EXISTS ids_finales AS
SELECT DISTINCT ON (model_id, platform_id, period_date)
  id
FROM model_values
WHERE period_date IN ('2026-01-01', '2026-01-16')
ORDER BY model_id, platform_id, period_date, updated_at DESC;

-- Eliminar duplicados
DELETE FROM model_values
WHERE period_date IN ('2026-01-01', '2026-01-16')
  AND id NOT IN (SELECT id FROM ids_finales);

-- Limpiar
DROP TABLE IF EXISTS ids_finales;

-- ==========================================
-- PASO G: VERIFICACIÓN FINAL
-- ==========================================
-- EJECUTA ESTO para ver el resultado final

SELECT 
  period_date,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  COUNT(DISTINCT platform_id) as plataformas,
  ROUND(SUM(value)::numeric, 2) as suma_total
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31'
GROUP BY period_date
ORDER BY period_date;

-- RESULTADO ESPERADO:
-- 2026-01-01 | ~400 | ~22 | ~20 | $XXXXX
-- 2026-01-16 | ~400 | ~22 | ~20 | $XXXXX

SELECT '✅ NORMALIZACIÓN COMPLETADA' as resultado;
