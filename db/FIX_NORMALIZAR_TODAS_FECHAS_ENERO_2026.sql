-- 🔧 FIX COMPLETO: Normalizar TODAS las fechas de enero 2026 a sus buckets correctos
-- P1 (días 1-15) → día 1
-- P2 (días 16-31) → día 16

-- PASO 1: Ver el estado actual (cuántos valores hay por fecha)
SELECT 
  period_date,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  SUM(value) as suma_total
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31'
GROUP BY period_date
ORDER BY period_date;

-- PASO 2: Ver cuántos valores se normalizarán
-- P1: Días 2-15 → día 1
SELECT 
  'P1 - Fechas intermedias a normalizar' as tipo,
  COUNT(*) as total_a_normalizar,
  COUNT(DISTINCT model_id) as modelos_afectadas
FROM model_values
WHERE period_date >= '2026-01-02' 
  AND period_date <= '2026-01-15';

-- P2: Días 17-31 → día 16
SELECT 
  'P2 - Fechas intermedias a normalizar' as tipo,
  COUNT(*) as total_a_normalizar,
  COUNT(DISTINCT model_id) as modelos_afectadas
FROM model_values
WHERE period_date >= '2026-01-17' 
  AND period_date <= '2026-01-31';

-- PASO 3: EJECUTAR LA NORMALIZACIÓN
-- ⚠️ IMPORTANTE: Esto consolidará todos los valores a día 1 o día 16
-- Si hay duplicados (modelo+plataforma en múltiples fechas), el endpoint
-- automáticamente tomará el más reciente por updated_at

-- Normalizar P1 (días 2-15 → día 1)
UPDATE model_values
SET period_date = '2026-01-01'
WHERE period_date >= '2026-01-02' 
  AND period_date <= '2026-01-15';

-- Normalizar P2 (días 17-31 → día 16)
UPDATE model_values
SET period_date = '2026-01-16'
WHERE period_date >= '2026-01-17' 
  AND period_date <= '2026-01-31';

-- PASO 4: Eliminar duplicados (quedarse solo con el más reciente)
-- Cuando normalizamos, pueden quedar múltiples registros con la misma
-- model_id + platform_id + period_date. Eliminamos los antiguos.

-- Primero identificar duplicados de P1
WITH duplicados_p1 AS (
  SELECT 
    id,
    model_id,
    platform_id,
    period_date,
    value,
    updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY model_id, platform_id, period_date 
      ORDER BY updated_at DESC
    ) as rn
  FROM model_values
  WHERE period_date = '2026-01-01'
)
DELETE FROM model_values
WHERE id IN (
  SELECT id FROM duplicados_p1 WHERE rn > 1
);

-- Luego identificar duplicados de P2
WITH duplicados_p2 AS (
  SELECT 
    id,
    model_id,
    platform_id,
    period_date,
    value,
    updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY model_id, platform_id, period_date 
      ORDER BY updated_at DESC
    ) as rn
  FROM model_values
  WHERE period_date = '2026-01-16'
)
DELETE FROM model_values
WHERE id IN (
  SELECT id FROM duplicados_p2 WHERE rn > 1
);

-- PASO 5: Verificar resultado final
SELECT 
  period_date,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  SUM(value) as suma_total
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-31'
GROUP BY period_date
ORDER BY period_date;

-- RESULTADO ESPERADO:
-- Solo deberían quedar 2 filas:
-- 2026-01-01 → Todos los valores de P1 (consolidados, más recientes)
-- 2026-01-16 → Todos los valores de P2 (consolidados, más recientes)
