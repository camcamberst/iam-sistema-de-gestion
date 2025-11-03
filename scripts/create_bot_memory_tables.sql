-- Tablas para Sistema de Memoria del Bot
-- ========================================

-- 1. TABLA DE MEMORIA DEL BOT
CREATE TABLE IF NOT EXISTS bot_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('preference', 'context', 'fact', 'reminder', 'goal', 'issue')),
  key TEXT NOT NULL,
  value JSONB NOT NULL, -- Almacena cualquier tipo de dato
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, key) -- Solo una entrada por key por usuario
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS bot_memory_user_id_idx ON bot_memory(user_id);
CREATE INDEX IF NOT EXISTS bot_memory_type_idx ON bot_memory(type);
CREATE INDEX IF NOT EXISTS bot_memory_key_idx ON bot_memory(key);
CREATE INDEX IF NOT EXISTS bot_memory_updated_at_idx ON bot_memory(updated_at DESC);

-- 2. TABLA DE RESUMENES DE CONVERSACIÓN
CREATE TABLE IF NOT EXISTS bot_conversation_summaries (
  conversation_id UUID PRIMARY KEY REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_points TEXT[] DEFAULT '{}',
  important_facts TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS bot_conversation_summaries_user_id_idx ON bot_conversation_summaries(user_id);
CREATE INDEX IF NOT EXISTS bot_conversation_summaries_updated_at_idx ON bot_conversation_summaries(updated_at DESC);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_bot_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bot_memory_updated_at_trigger
  BEFORE UPDATE ON bot_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_memory_updated_at();

CREATE TRIGGER update_bot_conversation_summaries_updated_at_trigger
  BEFORE UPDATE ON bot_conversation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_memory_updated_at();

-- RLS Policies
ALTER TABLE bot_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Políticas: usuarios solo pueden ver sus propias memorias
CREATE POLICY "Users can view own memories" ON bot_memory
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all memories" ON bot_memory
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own conversation summaries" ON bot_conversation_summaries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all summaries" ON bot_conversation_summaries
  FOR ALL USING (auth.role() = 'service_role');

