-- Tabla para almacenar conocimiento global del sistema que Botty puede aprender
-- ============================================================================
-- Permite que admins/super admins entrenen a Botty y agreguen información
-- que será incluida en los prompts de todas las conversaciones

CREATE TABLE IF NOT EXISTS bot_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(100) NOT NULL, -- 'system_info', 'tips', 'policies', 'procedures', 'faq', 'custom'
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}'::TEXT[], -- Para búsqueda: ['makeup', 'iluminacion', 'anticipos', etc.]
  priority INTEGER DEFAULT 0, -- 0 = normal, >0 = más importante
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_category ON bot_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_active ON bot_knowledge_base(is_active);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_tags ON bot_knowledge_base USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_priority ON bot_knowledge_base(priority DESC);
CREATE INDEX IF NOT EXISTS idx_bot_knowledge_updated_at ON bot_knowledge_base(updated_at DESC);

-- Comentarios
COMMENT ON TABLE bot_knowledge_base IS 'Base de conocimiento global que Botty usa en todos sus prompts. Los admins pueden agregar información aquí para entrenar a Botty.';
COMMENT ON COLUMN bot_knowledge_base.category IS 'Categoría: system_info, tips, policies, procedures, faq, custom';
COMMENT ON COLUMN bot_knowledge_base.tags IS 'Array de tags para búsqueda semántica';
COMMENT ON COLUMN bot_knowledge_base.priority IS 'Prioridad: 0 = normal, mayor = más importante';

-- RLS: Solo admins y super admins pueden gestionar conocimiento
ALTER TABLE bot_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bot knowledge" ON bot_knowledge_base
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND (users.role = 'super_admin' OR users.role = 'admin')
    )
  );

CREATE POLICY "Everyone can view active bot knowledge" ON bot_knowledge_base
  FOR SELECT USING (is_active = true);

-- Trigger para actualizar updated_at y updated_by
CREATE OR REPLACE FUNCTION update_bot_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bot_knowledge_updated_at_trigger
  BEFORE UPDATE ON bot_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_knowledge_updated_at();

