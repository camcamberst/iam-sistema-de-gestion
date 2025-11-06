-- Tabla para almacenar recursos útiles (enlaces, documentos, guías) para Botty
-- ============================================================================

CREATE TABLE IF NOT EXISTS bot_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'tips_transmision',
    'tips_plataforma',
    'guia_tecnica',
    'soporte',
    'consejeria',
    'productividad',
    'seguridad',
    'general'
  )),
  platform_id TEXT REFERENCES calculator_platforms(id) ON DELETE SET NULL, -- NULL = general, no específico de plataforma
  tags TEXT[] DEFAULT '{}'::TEXT[], -- Tags para búsqueda: ['makeup', 'iluminacion', 'angulos', etc.]
  priority INTEGER DEFAULT 0, -- 0 = normal, >0 = más importante
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_bot_resources_category ON bot_resources(category);
CREATE INDEX IF NOT EXISTS idx_bot_resources_platform ON bot_resources(platform_id);
CREATE INDEX IF NOT EXISTS idx_bot_resources_active ON bot_resources(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_resources_tags ON bot_resources USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_bot_resources_priority ON bot_resources(priority DESC);

-- Comentarios
COMMENT ON TABLE bot_resources IS 'Recursos útiles (enlaces, guías, documentos) que Botty puede usar para responder consultas';
COMMENT ON COLUMN bot_resources.category IS 'Categoría del recurso: tips_transmision, tips_plataforma, guia_tecnica, soporte, consejeria, productividad, seguridad, general';
COMMENT ON COLUMN bot_resources.platform_id IS 'Si es NULL, es recurso general. Si tiene valor, es específico de esa plataforma';
COMMENT ON COLUMN bot_resources.tags IS 'Array de tags para búsqueda semántica: makeup, iluminacion, angulos, etc.';
COMMENT ON COLUMN bot_resources.priority IS 'Prioridad del recurso: 0 = normal, mayor = más importante';

-- RLS: Solo super admins pueden gestionar recursos
ALTER TABLE bot_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all bot resources" ON bot_resources
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Everyone can view active bot resources" ON bot_resources
  FOR SELECT USING (is_active = true);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_bot_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bot_resources_updated_at_trigger
  BEFORE UPDATE ON bot_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_resources_updated_at();




