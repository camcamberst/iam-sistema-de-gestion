-- SISTEMA DE CHAT BIDIRECCIONAL PARA AIM
-- =====================================================
-- Este script crea las tablas necesarias para el sistema de chat
-- SIN AFECTAR las tablas existentes del sistema

-- 1. CONVERSACIONES ENTRE USUARIOS
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  conversation_type VARCHAR(20) DEFAULT 'direct' CHECK (conversation_type IN ('direct', 'support')),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(participant_1_id, participant_2_id)
);

-- 2. MENSAJES DEL CHAT
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'ai_response', 'system', 'file')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. CONSULTAS DE SOPORTE/AI
CREATE TABLE IF NOT EXISTS chat_support_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_type VARCHAR(30) NOT NULL CHECK (query_type IN ('webcam_industry', 'technical_support', 'general')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  ai_response TEXT,
  admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. ESTADOS DE USUARIOS EN LÍNEA
CREATE TABLE IF NOT EXISTS chat_user_status (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  status_message VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_1 ON chat_conversations(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_2 ON chat_conversations(participant_2_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_support_queries_user_id ON chat_support_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_support_queries_status ON chat_support_queries(status);
CREATE INDEX IF NOT EXISTS idx_chat_user_status_online ON chat_user_status(is_online, last_seen);

-- FUNCIONES DE UTILIDAD
-- Función para actualizar last_message_at en conversaciones
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar last_message_at automáticamente
CREATE TRIGGER trigger_update_conversation_last_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Función para limpiar conversaciones inactivas (más de 30 días)
CREATE OR REPLACE FUNCTION cleanup_inactive_conversations()
RETURNS void AS $$
BEGIN
  UPDATE chat_conversations 
  SET is_active = false
  WHERE last_message_at < NOW() - INTERVAL '30 days' 
  AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- RLS (Row Level Security) - POLÍTICAS DE SEGURIDAD
-- Habilitar RLS en todas las tablas
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_support_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_user_status ENABLE ROW LEVEL SECURITY;

-- Políticas para chat_conversations
CREATE POLICY "Users can view their conversations" ON chat_conversations
FOR SELECT USING (
  participant_1_id = auth.uid() OR 
  participant_2_id = auth.uid()
);

CREATE POLICY "Users can create conversations" ON chat_conversations
FOR INSERT WITH CHECK (
  participant_1_id = auth.uid() OR 
  participant_2_id = auth.uid()
);

CREATE POLICY "Users can update their conversations" ON chat_conversations
FOR UPDATE USING (
  participant_1_id = auth.uid() OR 
  participant_2_id = auth.uid()
);

-- Políticas para chat_messages
CREATE POLICY "Users can view messages from their conversations" ON chat_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM chat_conversations 
    WHERE id = conversation_id 
    AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
  )
);

CREATE POLICY "Users can send messages to their conversations" ON chat_messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM chat_conversations 
    WHERE id = conversation_id 
    AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
  )
);

CREATE POLICY "Users can update their own messages" ON chat_messages
FOR UPDATE USING (sender_id = auth.uid());

-- Políticas para chat_support_queries
CREATE POLICY "Users can view their own support queries" ON chat_support_queries
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create support queries" ON chat_support_queries
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own support queries" ON chat_support_queries
FOR UPDATE USING (user_id = auth.uid());

-- Políticas para chat_user_status
CREATE POLICY "Users can view all user status" ON chat_user_status
FOR SELECT USING (true);

CREATE POLICY "Users can update their own status" ON chat_user_status
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own status" ON chat_user_status
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Políticas especiales para super_admin
CREATE POLICY "Super admins can view all conversations" ON chat_conversations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can view all messages" ON chat_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  )
);

CREATE POLICY "Super admins can view all support queries" ON chat_support_queries
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  )
);

-- ✅ CONFIRMACIÓN
SELECT 'Sistema de chat creado exitosamente' as status;
