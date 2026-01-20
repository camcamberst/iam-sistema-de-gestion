-- 🔧 FIX: Limpiar valores de P2 enero 2026
-- Esto eliminará SOLO los valores de P2 (día 16 y posteriores)
-- para que las modelos puedan volver a ingresar valores frescos

-- ⚠️ PRECAUCIÓN: Ejecuta el DEBUG primero para ver qué valores hay

-- 1. Ver qué se va a eliminar (PRIMERO EJECUTA ESTO)
SELECT 
  COUNT(*) as total_a_eliminar,
  COUNT(DISTINCT model_id) as modelos_afectadas,
  STRING_AGG(DISTINCT platform_id, ', ') as plataformas
FROM model_values
WHERE period_date >= '2026-01-16' 
  AND period_date <= '2026-01-31';

-- 2. Si estás seguro, ejecuta esto para eliminar
-- DELETE FROM model_values
-- WHERE period_date >= '2026-01-16' 
--   AND period_date <= '2026-01-31';

-- 3. Verificar que se eliminó correctamente
-- SELECT COUNT(*) as valores_restantes
-- FROM model_values
-- WHERE period_date >= '2026-01-16' 
--   AND period_date <= '2026-01-31';
