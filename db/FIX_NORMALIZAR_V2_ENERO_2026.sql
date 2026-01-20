-- 🔧 FIX V2: Normalizar fechas de enero 2026 (SIN ERRORES DE CONSTRAINT)
-- Estrategia: Primero eliminar duplicados, LUEGO normalizar

-- ==========================================
-- PASO 1: Ver estado actual
-- ==========================================
SELECT 
  'Estado actual' as paso,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id || platform_id || period_date) as registros_unicos,
  COUNT(*) - COUNT(DISTINCT model_id || platform_id || period_date) as duplicados
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31';

-- ==========================================
-- PASO 2: ELIMINAR DUPLICADOS PREEXISTENTES
-- ==========================================
-- Si hay múltiples registros con la misma model_id + platform_id + period_date,
-- nos quedamos solo con el más reciente (updated_at DESC)

WITH duplicados_existentes AS (
  SELECT 
    id,
    model_id,
    platform_id,
    period_date,
    updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY model_id, platform_id, period_date 
      ORDER BY updated_at DESC
    ) as rn
  FROM model_values
  WHERE period_date >= '2026-01-01' 
    AND period_date <= '2026-01-31'
)
DELETE FROM model_values
WHERE id IN (
  SELECT id FROM duplicados_existentes WHERE rn > 1
);

-- Ver cuántos se eliminaron
SELECT 
  'Duplicados eliminados' as paso,
  COUNT(*) as registros_restantes
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31';

-- ==========================================
-- PASO 3: CREAR TABLA TEMPORAL CON VALORES CONSOLIDADOS
-- ==========================================
-- Para cada modelo+plataforma en P1 y P2, tomar el valor más reciente
-- Esto evita que el UPDATE cause duplicados

CREATE TEMP TABLE valores_consolidados AS
WITH valores_p1 AS (
  SELECT 
    model_id,
    platform_id,
    value,
    updated_at,
    '2026-01-01'::date as new_period_date,
    ROW_NUMBER() OVER (
      PARTITION BY model_id, platform_id 
      ORDER BY updated_at DESC
    ) as rn
  FROM model_values
  WHERE period_date >= '2026-01-01' 
    AND period_date <= '2026-01-15'
),
valores_p2 AS (
  SELECT 
    model_id,
    platform_id,
    value,
    updated_at,
    '2026-01-16'::date as new_period_date,
    ROW_NUMBER() OVER (
      PARTITION BY model_id, platform_id 
      ORDER BY updated_at DESC
    ) as rn
  FROM model_values
  WHERE period_date >= '2026-01-16' 
    AND period_date <= '2026-01-31'
)
SELECT * FROM valores_p1 WHERE rn = 1
UNION ALL
SELECT * FROM valores_p2 WHERE rn = 1;

-- Ver cuántos valores consolidados tenemos
SELECT 
  'Valores consolidados preparados' as paso,
  COUNT(*) as total,
  COUNT(DISTINCT model_id) as modelos,
  SUM(CASE WHEN new_period_date = '2026-01-01' THEN 1 ELSE 0 END) as p1_valores,
  SUM(CASE WHEN new_period_date = '2026-01-16' THEN 1 ELSE 0 END) as p2_valores
FROM valores_consolidados;

-- ==========================================
-- PASO 4: ELIMINAR TODOS LOS VALORES DE ENERO 2026
-- ==========================================
DELETE FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31';

-- Confirmar eliminación
SELECT 
  'Valores enero 2026 eliminados' as paso,
  COUNT(*) as registros_restantes
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31';

-- ==========================================
-- PASO 5: INSERTAR VALORES CONSOLIDADOS
-- ==========================================
INSERT INTO model_values (model_id, platform_id, value, period_date, updated_at, created_at)
SELECT 
  model_id,
  platform_id,
  value,
  new_period_date,
  updated_at,
  NOW()
FROM valores_consolidados;

-- Ver resultado final
SELECT 
  'Valores consolidados insertados' as paso,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31';

-- ==========================================
-- PASO 6: VERIFICAR RESULTADO FINAL
-- ==========================================
SELECT 
  period_date,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  COUNT(DISTINCT platform_id) as plataformas,
  SUM(value) as suma_total
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31'
GROUP BY period_date
ORDER BY period_date;

-- RESULTADO ESPERADO:
-- Solo 2 filas:
-- 2026-01-01 | ~400 registros | ~22 modelos | ~20 plataformas
-- 2026-01-16 | ~400 registros | ~22 modelos | ~20 plataformas

-- ==========================================
-- PASO 7: LIMPIAR TABLA TEMPORAL
-- ==========================================
DROP TABLE IF EXISTS valores_consolidados;

SELECT '✅ PROCESO COMPLETADO - Fechas normalizadas correctamente' as resultado;
