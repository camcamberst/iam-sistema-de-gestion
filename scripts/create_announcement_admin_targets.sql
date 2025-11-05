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
  UNIQUE(announcement_id, admin_id),
  CONSTRAINT check_admin_role CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = admin_id 
      AND role IN ('admin', 'super_admin')
    )
  )
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

-- Comentarios de documentación
COMMENT ON TABLE announcement_admin_targets IS 'Relación N:M entre anuncios y admins específicos como destinatarios';
COMMENT ON COLUMN announcement_admin_targets.announcement_id IS 'ID del anuncio';
COMMENT ON COLUMN announcement_admin_targets.admin_id IS 'ID del admin destinatario (debe ser admin o super_admin)';

