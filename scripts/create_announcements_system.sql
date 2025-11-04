-- =====================================================
-- 📌 SISTEMA DE CORCHO INFORMATIVO (ANUNCIOS)
-- =====================================================
-- Sistema de publicaciones tipo blog/revista para mantener
-- informadas a las modelos con información relevante
-- =====================================================

-- 1. 📂 CATEGORÍAS DE ANUNCIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS announcement_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- "Noticias", "Recordatorios", "Promociones", etc.
  slug TEXT NOT NULL UNIQUE,              -- "noticias", "recordatorios", "promociones"
  icon TEXT,                             -- Nombre del icono SVG o emoji
  color TEXT DEFAULT '#3B82F6',          -- Color de la categoría (hex)
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 📄 ANUNCIOS/PUBLICACIONES
-- =====================================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category_id UUID REFERENCES announcement_categories(id) ON DELETE SET NULL,
  
  -- Contenido
  title TEXT NOT NULL,
  content TEXT NOT NULL,                 -- Contenido en Markdown o HTML
  excerpt TEXT,                           -- Resumen corto para preview
  
  -- Imágenes y multimedia
  featured_image_url TEXT,                -- URL de imagen destacada (Supabase Storage)
  image_urls JSONB DEFAULT '[]',          -- Array de URLs de imágenes adicionales
  
  -- Distribución
  is_general BOOLEAN DEFAULT false,       -- true = todos los grupos, false = grupos específicos
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Estado
  is_published BOOLEAN DEFAULT false,     -- Borrador vs Publicado
  is_pinned BOOLEAN DEFAULT false,        -- Fijar en la parte superior
  priority INTEGER DEFAULT 0,             -- 0=normal, 1=alta, 2=urgente
  
  -- Metadatos
  views_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,               -- Fecha de publicación
  expires_at TIMESTAMPTZ,                 -- Fecha de expiración (opcional)
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 🎯 RELACIÓN ANUNCIO-GRUPO (N:M)
-- =====================================================
CREATE TABLE IF NOT EXISTS announcement_group_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, group_id)
);

-- 4. 👁️ TRACKING DE VISUALIZACIONES (opcional)
-- =====================================================
CREATE TABLE IF NOT EXISTS announcement_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Índices para optimización
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_announcements_category ON announcements(category_id);
CREATE INDEX IF NOT EXISTS idx_announcements_author ON announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_expires ON announcements(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_announcement_group_targets_announcement ON announcement_group_targets(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_group_targets_group ON announcement_group_targets(group_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_user ON announcement_views(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement ON announcement_views(announcement_id);

-- Trigger para updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_announcement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_announcement_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcement_updated_at();

CREATE TRIGGER trigger_update_category_updated_at
  BEFORE UPDATE ON announcement_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_announcement_updated_at();

-- Insertar categorías iniciales
-- =====================================================
INSERT INTO announcement_categories (name, slug, icon, color, description) VALUES
  ('Noticias', 'noticias', '📰', '#3B82F6', 'Noticias generales y actualizaciones'),
  ('Recordatorios', 'recordatorios', '🔔', '#F59E0B', 'Recordatorios importantes'),
  ('Promociones', 'promociones', '🎉', '#10B981', 'Promociones y ofertas especiales'),
  ('Tips', 'tips', '💡', '#8B5CF6', 'Consejos y recomendaciones'),
  ('Análisis', 'analisis', '📊', '#EF4444', 'Análisis y métricas')
ON CONFLICT (slug) DO NOTHING;

-- RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE announcement_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_group_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_views ENABLE ROW LEVEL SECURITY;

-- Policy: Categorías - Lectura pública para todos los usuarios autenticados
CREATE POLICY "categorias_lectura_publica"
  ON announcement_categories FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
  );

-- Policy: Anuncios - Lectura para modelos (solo publicaciones visibles para sus grupos)
CREATE POLICY "modelos_lectura_announcements"
  ON announcements FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_published = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      -- Si es general, todos pueden ver
      is_general = true
      OR
      -- Si es específico, verificar que el usuario pertenece a algún grupo objetivo
      EXISTS (
        SELECT 1 FROM user_groups ug
        INNER JOIN announcement_group_targets agt ON ug.group_id = agt.group_id
        WHERE ug.user_id = auth.uid()
        AND agt.announcement_id = announcements.id
      )
    )
  );

-- Policy: Anuncios - Lectura completa para admins y super_admins
CREATE POLICY "admins_lectura_completa_announcements"
  ON announcements FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Anuncios - Crear (solo admins y super_admins)
CREATE POLICY "admins_crear_announcements"
  ON announcements FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
    AND author_id = auth.uid()
  );

-- Policy: Anuncios - Actualizar (solo autor, super_admin, o admin del mismo grupo)
CREATE POLICY "admins_actualizar_announcements"
  ON announcements FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      -- El autor puede editar
      author_id = auth.uid()
      OR
      -- Super admin puede editar todo
      EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role = 'super_admin'
      )
      OR
      -- Admin puede editar si es de su organización
      EXISTS (
        SELECT 1 FROM users u
        INNER JOIN announcements a ON a.organization_id = u.organization_id
        WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND a.id = announcements.id
      )
    )
  );

-- Policy: Anuncios - Eliminar (mismo que actualizar)
CREATE POLICY "admins_eliminar_announcements"
  ON announcements FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      author_id = auth.uid()
      OR
      EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role = 'super_admin'
      )
    )
  );

-- Policy: Announcement Group Targets - Lectura para usuarios autenticados
CREATE POLICY "lectura_announcement_group_targets"
  ON announcement_group_targets FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Policy: Announcement Group Targets - Crear/Actualizar/Eliminar (solo admins)
CREATE POLICY "admins_gestion_announcement_group_targets"
  ON announcement_group_targets FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  );

-- Policy: Announcement Views - Lectura y escritura para usuarios autenticados
CREATE POLICY "usuarios_gestion_announcement_views"
  ON announcement_views FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
      )
    )
  );

-- Comentarios de documentación
-- =====================================================
COMMENT ON TABLE announcement_categories IS 'Categorías temáticas para organizar los anuncios';
COMMENT ON TABLE announcements IS 'Publicaciones/anuncios del corcho informativo';
COMMENT ON TABLE announcement_group_targets IS 'Relación N:M entre anuncios y grupos objetivo';
COMMENT ON TABLE announcement_views IS 'Tracking de visualizaciones de anuncios por usuario';

COMMENT ON COLUMN announcements.is_general IS 'true = visible para todos, false = solo grupos específicos';
COMMENT ON COLUMN announcements.is_pinned IS 'true = aparece fijado en la parte superior';
COMMENT ON COLUMN announcements.priority IS '0=normal, 1=alta, 2=urgente';

