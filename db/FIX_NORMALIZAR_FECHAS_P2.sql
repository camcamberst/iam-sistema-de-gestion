-- 🔧 FIX: Normalizar fechas de P2 a día 16
-- Este script actualiza todos los valores de P2 que estén guardados
-- en fechas intermedias (17, 18, 19, 20, etc.) al día 16 correcto

-- 1. Ver qué valores están en fechas intermedias de P2
SELECT 
  period_date,
  COUNT(*) as registros,
  COUNT(DISTINCT model_id) as modelos,
  SUM(value) as suma_valores
FROM model_values
WHERE period_date >= '2026-01-16' 
  AND period_date <= '2026-01-31'
  AND period_date != '2026-01-16'  -- Solo los que NO están en día 16
GROUP BY period_date
ORDER BY period_date;

-- 2. Actualizar todas las fechas de P2 al día 16 (bucke correcto)
-- ⚠️ Esto consolidará todos los valores de P2 en la fecha correcta
-- UPDATE model_values
-- SET period_date = '2026-01-16'
-- WHERE period_date >= '2026-01-17'  -- Del 17 en adelante
--   AND period_date <= '2026-01-31'
-- RETURNING model_id, platform_id, period_date, value;

-- 3. Resolver conflictos si hay (tomar el más reciente)
-- Si después del UPDATE quedan duplicados (modelo+plataforma+fecha),
-- el sistema automáticamente tomará el más reciente por updated_at

-- 4. Verificar resultado final
-- SELECT 
--   period_date,
--   COUNT(*) as total_valores
-- FROM model_values
-- WHERE period_date >= '2026-01-01' 
--   AND period_date <= '2026-01-31'
-- GROUP BY period_date
-- ORDER BY period_date;
