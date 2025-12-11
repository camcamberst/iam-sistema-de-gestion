-- Agregar columna reply_to_message_id a chat_messages
-- Esta columna permite referenciar el mensaje al que se está respondiendo

ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL;

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON public.chat_messages(reply_to_message_id);

-- Notificar a PostgREST para recargar el esquema
NOTIFY pgrst, 'reload schema';

