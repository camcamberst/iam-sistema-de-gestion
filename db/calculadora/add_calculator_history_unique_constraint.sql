-- =====================================================
-- 🔧 AGREGAR CONSTRAINT ÚNICO A CALCULATOR_HISTORY
-- =====================================================
-- Este constraint permite usar upsert con onConflict
-- para evitar duplicados por (model_id, platform_id, period_date, period_type)
-- =====================================================

-- Crear constraint único si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'calculator_history_unique_model_platform_period'
  ) THEN
    ALTER TABLE calculator_history
      ADD CONSTRAINT calculator_history_unique_model_platform_period
      UNIQUE (model_id, platform_id, period_date, period_type);
    
    RAISE NOTICE '✅ Constraint único creado exitosamente';
  ELSE
    RAISE NOTICE 'ℹ️ El constraint único ya existe';
  END IF;
END $$;

-- Verificar que se creó correctamente
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint 
WHERE conname = 'calculator_history_unique_model_platform_period';

