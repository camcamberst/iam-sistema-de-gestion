-- ==========================================
-- SCRIPT: FUNCIONES AVANZADAS DE CHAT
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- 1. Modificar tabla de mensajes para "Eliminar para todos"
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS is_deleted_for_all BOOLEAN DEFAULT FALSE;

-- 2. Tabla para "Eliminar para mí" (Mensajes ocultos)
CREATE TABLE IF NOT EXISTS public.chat_hidden_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, message_id)
);

ALTER TABLE public.chat_hidden_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios gestionan sus mensajes ocultos" 
ON public.chat_hidden_messages FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_chat_hidden_user ON public.chat_hidden_messages(user_id);

-- 3. Tabla para "Vaciar Chat" (Historial limpiado)
CREATE TABLE IF NOT EXISTS public.chat_cleared_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    cleared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, conversation_id)
);

ALTER TABLE public.chat_cleared_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios gestionan su historial vaciado" 
ON public.chat_cleared_history FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_chat_cleared_user_conv ON public.chat_cleared_history(user_id, conversation_id);

-- 4. Tabla para Participantes Extras (Grupos)
CREATE TABLE IF NOT EXISTS public.chat_group_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    added_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

ALTER TABLE public.chat_group_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participantes pueden verse en el grupo" 
ON public.chat_group_participants FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.chat_group_participants cgp WHERE cgp.conversation_id = chat_group_participants.conversation_id
    UNION
    SELECT participant_1_id FROM public.chat_conversations cc WHERE cc.id = chat_group_participants.conversation_id
    UNION
    SELECT participant_2_id FROM public.chat_conversations cc WHERE cc.id = chat_group_participants.conversation_id
  )
);

CREATE POLICY "Solo participantes pueden añadir a otros" 
ON public.chat_group_participants FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT participant_1_id FROM public.chat_conversations cc WHERE cc.id = chat_group_participants.conversation_id
    UNION
    SELECT participant_2_id FROM public.chat_conversations cc WHERE cc.id = chat_group_participants.conversation_id
    UNION
    SELECT user_id FROM public.chat_group_participants cgp WHERE cgp.conversation_id = chat_group_participants.conversation_id
  )
);
CREATE INDEX IF NOT EXISTS idx_chat_group_conv ON public.chat_group_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_group_user ON public.chat_group_participants(user_id);
