-- 1. Crear la tabla si no existe
CREATE TABLE IF NOT EXISTS public.chat_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

-- 2. Crear índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_user_message ON public.chat_message_reads(user_id, message_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message ON public.chat_message_reads(message_id);

-- 3. Habilitar RLS
ALTER TABLE public.chat_message_reads ENABLE ROW LEVEL SECURITY;

-- 4. Otorgar permisos básicos (CRÍTICO para que la API la vea)
GRANT ALL ON public.chat_message_reads TO postgres;
GRANT ALL ON public.chat_message_reads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_message_reads TO authenticated;
GRANT SELECT ON public.chat_message_reads TO anon;

-- 5. Definir políticas RLS
-- Permitir ver sus propias lecturas
DROP POLICY IF EXISTS "Users can see their own reads" ON public.chat_message_reads;
CREATE POLICY "Users can see their own reads"
ON public.chat_message_reads FOR SELECT
USING (auth.uid() = user_id);

-- Permitir insertar sus propias lecturas
DROP POLICY IF EXISTS "Users can mark messages as read" ON public.chat_message_reads;
CREATE POLICY "Users can mark messages as read"
ON public.chat_message_reads FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Permitir ver lecturas de mensajes en conversaciones donde participan
-- (Para saber si el otro usuario leyó mi mensaje)
DROP POLICY IF EXISTS "Users can see reads of messages in their conversations" ON public.chat_message_reads;
CREATE POLICY "Users can see reads of messages in their conversations"
ON public.chat_message_reads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages cm
    JOIN public.chat_conversations cc ON cm.conversation_id = cc.id
    WHERE cm.id = chat_message_reads.message_id
    AND (cc.participant_1_id = auth.uid() OR cc.participant_2_id = auth.uid())
  )
);

-- 6. Notificar a PostgREST para recargar el esquema
NOTIFY pgrst, 'reload schema';

