-- =====================================================
-- 🔧 CORRECCIÓN: delivered_at para estado 'pendiente'
-- =====================================================

-- Actualizar la función change_platform_status para establecer delivered_at cuando el estado es 'pendiente'
CREATE OR REPLACE FUNCTION change_platform_status(
  p_model_id UUID,
  p_platform_id TEXT,
  p_new_status TEXT,
  p_changed_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  platform_record modelo_plataformas%ROWTYPE;
BEGIN
  -- Obtener registro actual
  SELECT * INTO platform_record
  FROM modelo_plataformas
  WHERE model_id = p_model_id AND platform_id = p_platform_id;
  
  IF NOT FOUND THEN
    -- Crear nuevo registro si no existe
    INSERT INTO modelo_plataformas (
      model_id,
      platform_id,
      status,
      requested_by,
      notes
    ) VALUES (
      p_model_id,
      p_platform_id,
      p_new_status,
      p_changed_by,
      p_reason
    );
  ELSE
    -- Actualizar registro existente
    UPDATE modelo_plataformas SET
      status = p_new_status,
      notes = COALESCE(p_reason, notes),
      delivered_at = CASE WHEN p_new_status IN ('pendiente', 'entregada') THEN now() ELSE delivered_at END,
      delivered_by = CASE WHEN p_new_status IN ('pendiente', 'entregada') THEN p_changed_by ELSE delivered_by END,
      deactivated_at = CASE WHEN p_new_status = 'desactivada' THEN now() ELSE deactivated_at END,
      deactivated_by = CASE WHEN p_new_status = 'desactivada' THEN p_changed_by ELSE deactivated_by END,
      reverted_at = CASE WHEN platform_record.status = 'inviable' AND p_new_status != 'inviable' THEN now() ELSE reverted_at END,
      reverted_by = CASE WHEN platform_record.status = 'inviable' AND p_new_status != 'inviable' THEN p_changed_by ELSE reverted_by END,
      revert_reason = CASE WHEN platform_record.status = 'inviable' AND p_new_status != 'inviable' THEN p_reason ELSE revert_reason END,
      updated_at = now()
    WHERE model_id = p_model_id AND platform_id = p_platform_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 🔄 ACTUALIZAR REGISTROS EXISTENTES
-- =====================================================

-- Actualizar registros existentes que están en estado 'pendiente' pero no tienen delivered_at
UPDATE modelo_plataformas 
SET delivered_at = updated_at
WHERE status = 'pendiente' 
AND delivered_at IS NULL;

-- Verificar la corrección
SELECT 
  id,
  model_id,
  platform_id,
  status,
  requested_at,
  delivered_at,
  confirmed_at,
  updated_at
FROM modelo_plataformas 
WHERE status = 'pendiente'
ORDER BY updated_at DESC
LIMIT 5;
