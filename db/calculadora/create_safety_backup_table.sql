-- ═══════════════════════════════════════════════════════════
-- 🛡️ TABLA DE BACKUP DE SEGURIDAD INQUEBRANTABLE
-- ═══════════════════════════════════════════════════════════
-- Esta tabla almacena TODOS los valores de model_values antes
-- de cualquier DELETE. NUNCA se limpia automáticamente.
-- Solo se limpia manualmente después de verificar que el
-- archivo histórico se creó correctamente.
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS model_values_safety_backup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Datos originales de model_values
  original_id UUID NOT NULL,
  model_id UUID NOT NULL,
  platform_id TEXT NOT NULL,
  value NUMERIC NOT NULL,
  period_date DATE NOT NULL,
  original_created_at TIMESTAMPTZ NOT NULL,
  original_updated_at TIMESTAMPTZ NOT NULL,
  
  -- Metadata del backup
  backup_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  backup_reason TEXT NOT NULL DEFAULT 'period_closure',
  period_type TEXT NOT NULL,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  
  -- Estado del archivo histórico
  history_verified BOOLEAN NOT NULL DEFAULT FALSE,
  history_verified_at TIMESTAMPTZ,
  history_record_count INT,
  
  -- Información adicional
  archived_successfully BOOLEAN DEFAULT NULL,
  deleted_from_model_values BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_safety_backup_model_period 
  ON model_values_safety_backup(model_id, period_date);

CREATE INDEX IF NOT EXISTS idx_safety_backup_period_type 
  ON model_values_safety_backup(period_type, period_start_date);

CREATE INDEX IF NOT EXISTS idx_safety_backup_history_verified 
  ON model_values_safety_backup(history_verified);

-- RLS: Solo super_admin puede leer/escribir
ALTER TABLE model_values_safety_backup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow super_admin full access to safety backup" ON model_values_safety_backup;
CREATE POLICY "Allow super_admin full access to safety backup" 
  ON model_values_safety_backup
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  );

-- ═══════════════════════════════════════════════════════════
-- 🔒 FUNCIÓN DE BACKUP OBLIGATORIO ANTES DE DELETE
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_safety_backup_before_delete(
  p_model_id UUID,
  p_period_start_date DATE,
  p_period_end_date DATE,
  p_period_type TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  backed_up_count INT,
  backup_ids UUID[],
  error_message TEXT
) AS $$
DECLARE
  v_backup_count INT := 0;
  v_backup_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Insertar todos los valores en la tabla de backup
  WITH inserted AS (
    INSERT INTO model_values_safety_backup (
      original_id,
      model_id,
      platform_id,
      value,
      period_date,
      original_created_at,
      original_updated_at,
      backup_reason,
      period_type,
      period_start_date,
      period_end_date
    )
    SELECT 
      mv.id,
      mv.model_id,
      mv.platform_id,
      mv.value,
      mv.period_date,
      mv.created_at,
      mv.updated_at,
      'period_closure_safety_backup',
      p_period_type,
      p_period_start_date,
      p_period_end_date
    FROM model_values mv
    WHERE mv.model_id = p_model_id
      AND mv.period_date >= p_period_start_date
      AND mv.period_date <= p_period_end_date
    RETURNING id
  )
  SELECT COUNT(*), ARRAY_AGG(id)
  INTO v_backup_count, v_backup_ids
  FROM inserted;
  
  -- Retornar resultado
  RETURN QUERY SELECT 
    TRUE as success,
    v_backup_count,
    v_backup_ids,
    NULL::TEXT as error_message;
    
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    FALSE as success,
    0 as backed_up_count,
    ARRAY[]::UUID[] as backup_ids,
    SQLERRM as error_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════
-- 🔍 FUNCIÓN DE VERIFICACIÓN POST-ARCHIVO
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION verify_history_and_mark_backup(
  p_model_id UUID,
  p_period_start_date DATE,
  p_period_type TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  history_count INT,
  backup_count INT,
  match BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_history_count INT := 0;
  v_backup_count INT := 0;
BEGIN
  -- Contar registros en calculator_history
  SELECT COUNT(*)
  INTO v_history_count
  FROM calculator_history
  WHERE model_id = p_model_id
    AND period_date = p_period_start_date
    AND period_type = p_period_type;
  
  -- Contar registros en backup
  SELECT COUNT(DISTINCT platform_id)
  INTO v_backup_count
  FROM model_values_safety_backup
  WHERE model_id = p_model_id
    AND period_start_date = p_period_start_date
    AND period_type = p_period_type;
  
  -- Si coinciden, marcar como verificado
  IF v_history_count >= v_backup_count AND v_backup_count > 0 THEN
    UPDATE model_values_safety_backup
    SET 
      history_verified = TRUE,
      history_verified_at = NOW(),
      history_record_count = v_history_count,
      archived_successfully = TRUE
    WHERE model_id = p_model_id
      AND period_start_date = p_period_start_date
      AND period_type = p_period_type;
    
    RETURN QUERY SELECT 
      TRUE as success,
      v_history_count,
      v_backup_count,
      TRUE as match,
      NULL::TEXT as error_message;
  ELSE
    RETURN QUERY SELECT 
      FALSE as success,
      v_history_count,
      v_backup_count,
      FALSE as match,
      FORMAT('Mismatch: history=%s, backup=%s', v_history_count, v_backup_count) as error_message;
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    FALSE as success,
    0 as history_count,
    0 as backup_count,
    FALSE as match,
    SQLERRM as error_message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════
-- ✅ VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════

SELECT 
  'Tabla model_values_safety_backup creada' as status,
  COUNT(*) as registros_actuales
FROM model_values_safety_backup;

SELECT 
  'Funciones de backup creadas' as status;
