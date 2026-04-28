-- Script para permitir notas de voz (audio), stickers y gifs en el chat
-- 1. Remover el constraint anterior
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;

-- 2. Añadir el nuevo constraint usando NOT VALID
-- Esto le dice a PostgreSQL que aplique la regla solo a los NUEVOS mensajes
-- y no verifique si las filas antiguas la cumplen. (Se han añadido también tipos comunes extra por precaución)
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_message_type_check
CHECK (message_type IN ('text', 'image', 'file', 'audio', 'sticker', 'gif', 'system', 'video', 'document')) NOT VALID;
