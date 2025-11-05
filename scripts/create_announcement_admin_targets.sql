-- =====================================================
-- 📌 TABLA PARA PUBLICACIONES DIRIGIDAS A ADMINS ESPECÍFICOS
-- =====================================================
-- Permite que el super admin seleccione admins específicos
-- como destinatarios de publicaciones
-- =====================================================

-- Tabla para relación N:M entre anuncios y admins
CREATE TABLE IF NOT EXISTS announcement_admin_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, admin_id)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_announcement_admin_targets_announcement ON announcement_admin_targets(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_admin_targets_admin ON announcement_admin_targets(admin_id);

-- RLS Policies
-- =====================================================

-- Policy: Lectura para usuarios autenticados
CREATE POLICY "lectura_announcement_admin_targets"
ON announcement_admin_targets FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Policy: Crear/Actualizar/Eliminar (solo super_admin)
CREATE POLICY "super_admin_gestion_announcement_admin_targets"
ON announcement_admin_targets FOR ALL
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Trigger para validar que admin_id sea admin o super_admin (opcional)
CREATE OR REPLACE FUNCTION validate_admin_target_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = NEW.admin_id 
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'El usuario seleccionado debe ser admin o super_admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_admin_target_role
  BEFORE INSERT OR UPDATE ON announcement_admin_targets
  FOR EACH ROW
  EXECUTE FUNCTION validate_admin_target_role();

-- Comentarios de documentación
COMMENT ON TABLE announcement_admin_targets IS 'Relación N:M entre anuncios y admins específicos como destinatarios';
COMMENT ON COLUMN announcement_admin_targets.announcement_id IS 'ID del anuncio';
COMMENT ON COLUMN announcement_admin_targets.admin_id IS 'ID del admin destinatario (debe ser admin o super_admin)';

