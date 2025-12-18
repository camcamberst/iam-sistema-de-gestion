-- =====================================================
-- 🔄 MODIFICAR: gestor_historical_rates para rates globales
-- =====================================================
-- Las rates históricas ahora son GLOBALES (aplican a todas las sedes/grupos)
-- porque son solo para el histórico y la planilla de stats
-- =====================================================

-- 1. Eliminar el constraint único actual que incluye group_id
ALTER TABLE gestor_historical_rates 
  DROP CONSTRAINT IF EXISTS gestor_historical_rates_group_id_period_date_period_type_key;

-- 2. Hacer group_id opcional (NULL = rates globales)
ALTER TABLE gestor_historical_rates 
  ALTER COLUMN group_id DROP NOT NULL;

-- 3. Crear índice único parcial: solo period_date y period_type cuando group_id IS NULL (rates globales)
-- Esto permite solo UN set de rates por período (global)
-- PostgreSQL no permite WHERE en UNIQUE constraints, pero sí en índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS idx_gestor_historical_rates_global_unique 
  ON gestor_historical_rates (period_date, period_type) 
  WHERE group_id IS NULL;

-- 4. Si hay rates existentes con group_id, eliminarlas o migrarlas
-- (Opcional: mantener rates por grupo si existen, pero nuevas serán globales)
-- Por ahora, solo permitimos rates globales (group_id IS NULL)

-- 5. Actualizar comentarios
COMMENT ON COLUMN gestor_historical_rates.group_id IS 'ID del grupo/sede (NULL = rates globales para todas las sedes). Actualmente solo se usan rates globales.';

-- 6. Recargar esquema
NOTIFY pgrst, 'reload schema';

