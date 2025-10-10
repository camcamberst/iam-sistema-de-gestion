-- Agregar columna closed_at a modelo_plataformas para soportar timeline
ALTER TABLE modelo_plataformas 
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- Crear índice para mejorar performance de consultas del timeline
CREATE INDEX IF NOT EXISTS idx_modelo_plataformas_closed_at 
ON modelo_plataformas(closed_at) 
WHERE closed_at IS NULL;

-- Actualizar la vista modelo_plataformas_detailed para incluir closed_at
CREATE OR REPLACE VIEW modelo_plataformas_detailed AS
SELECT 
  mp.id,
  mp.model_id,
  u.name as model_name,
  u.email as model_email,
  mp.platform_id,
  cp.name as platform_name,
  cp.id as platform_code,
  mp.status,
  mp.requested_at,
  mp.delivered_at,
  mp.confirmed_at,
  mp.deactivated_at,
  mp.reverted_at,
  mp.closed_at,
  mp.notes,
  mp.revert_reason,
  mp.is_initial_config,
  mp.calculator_sync,
  mp.calculator_activated_at,
  mp.created_at,
  mp.updated_at,
  -- Información de quién realizó cada acción
  requested_by.name as requested_by_name,
  delivered_by.name as delivered_by_name,
  confirmed_by.name as confirmed_by_name,
  deactivated_by.name as deactivated_by_name,
  reverted_by.name as reverted_by_name,
  -- Información del grupo
  g.name as group_name,
  g.id as group_id
FROM modelo_plataformas mp
LEFT JOIN users u ON mp.model_id = u.id
LEFT JOIN calculator_platforms cp ON mp.platform_id = cp.id
LEFT JOIN users requested_by ON mp.requested_by = requested_by.id
LEFT JOIN users delivered_by ON mp.delivered_by = delivered_by.id
LEFT JOIN users confirmed_by ON mp.confirmed_by = confirmed_by.id
LEFT JOIN users deactivated_by ON mp.deactivated_by = deactivated_by.id
LEFT JOIN users reverted_by ON mp.reverted_by = reverted_by.id
LEFT JOIN user_groups ug ON u.id = ug.user_id
LEFT JOIN groups g ON ug.group_id = g.id;
