-- 🔄 RESET SIMPLE: Limpiar P2 de enero 2026
-- Las modelos volverán a ingresar sus valores

-- ==========================================
-- PASO 1: Ver qué hay actualmente en P2
-- ==========================================
SELECT 
  'Valores actuales en P2' as tipo,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  COUNT(DISTINCT platform_id) as plataformas,
  ROUND(SUM(value)::numeric, 2) as suma_total
FROM model_values
WHERE period_date >= '2026-01-16' 
  AND period_date <= '2026-01-31';

-- ==========================================
-- PASO 2: ELIMINAR TODOS LOS VALORES DE P2
-- ==========================================
-- Esto limpiará completamente P2 para que las modelos
-- puedan ingresar valores frescos desde cero

DELETE FROM model_values
WHERE period_date >= '2026-01-16' 
  AND period_date <= '2026-01-31';

-- ==========================================
-- PASO 3: Verificar que P2 quedó vacío
-- ==========================================
SELECT 
  'Valores después de limpieza' as tipo,
  COUNT(*) as registros_p2
FROM model_values
WHERE period_date >= '2026-01-16' 
  AND period_date <= '2026-01-31';

-- Debería devolver: registros_p2 = 0

-- ==========================================
-- PASO 4: Verificar que P1 sigue intacto
-- ==========================================
SELECT 
  'Valores de P1 (sin cambios)' as tipo,
  COUNT(*) as total_registros,
  COUNT(DISTINCT model_id) as modelos,
  ROUND(SUM(value)::numeric, 2) as suma_total
FROM model_values
WHERE period_date >= '2026-01-01' 
  AND period_date <= '2026-01-15';

-- ==========================================
-- RESULTADO ESPERADO:
-- ==========================================
-- P2: 0 registros (limpio para que las modelos ingresen valores nuevos)
-- P1: ~2000 registros (sin cambios)

SELECT '✅ P2 RESETEADO - Las modelos pueden ingresar valores frescos' as resultado;
