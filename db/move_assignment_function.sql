-- =====================================================
-- FUNCIÓN PARA MOVER ASIGNACIONES (TRANSACCIÓN ATÓMICA)
-- =====================================================
-- Elimina asignación anterior y crea nueva en una sola transacción
-- Garantiza consistencia de datos
-- =====================================================

CREATE OR REPLACE FUNCTION move_room_assignment(
  p_model_id UUID,
  p_from_room_id UUID,
  p_from_jornada VARCHAR(10),
  p_to_room_id UUID,
  p_to_jornada VARCHAR(10)
)
RETURNS JSON AS $$
DECLARE
  v_deleted_id UUID;
  v_new_id UUID;
  v_result JSON;
BEGIN
  -- 1. Verificar que existe la asignación origen
  SELECT id INTO v_deleted_id
  FROM room_assignments
  WHERE model_id = p_model_id
    AND room_id = p_from_room_id
    AND jornada = p_from_jornada;
  
  IF v_deleted_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Asignación origen no encontrada'
    );
  END IF;

  -- 2. Verificar que no existe conflicto en destino
  IF EXISTS (
    SELECT 1 FROM room_assignments
    WHERE model_id = p_model_id
      AND room_id = p_to_room_id
      AND jornada = p_to_jornada
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'La modelo ya está asignada en el destino'
    );
  END IF;

  -- 3. Verificar límite de 2 modelos por room+jornada en destino
  IF (
    SELECT COUNT(*)
    FROM room_assignments
    WHERE room_id = p_to_room_id
      AND jornada = p_to_jornada
  ) >= 2 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Máximo 2 modelos permitidas por room y jornada'
    );
  END IF;

  -- 4. TRANSACCIÓN: Eliminar origen + Crear destino
  BEGIN
    -- Eliminar asignación origen
    DELETE FROM room_assignments
    WHERE id = v_deleted_id;

    -- Crear asignación destino
    INSERT INTO room_assignments (model_id, room_id, jornada, assigned_at)
    VALUES (p_model_id, p_to_room_id, p_to_jornada, now())
    RETURNING id INTO v_new_id;

    -- Resultado exitoso
    v_result := json_build_object(
      'success', true,
      'deleted_id', v_deleted_id,
      'new_id', v_new_id,
      'message', 'Asignación movida exitosamente'
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- En caso de error, la transacción se revierte automáticamente
      v_result := json_build_object(
        'success', false,
        'error', 'Error durante la transacción: ' || SQLERRM
      );
  END;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
