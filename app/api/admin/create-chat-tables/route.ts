import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // SQL para crear las tablas de chat
    const createTablesSQL = `
      -- Crear tabla de conversaciones de chat
      CREATE TABLE IF NOT EXISTS public.chat_conversations (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          participant_1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          participant_2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(participant_1_id, participant_2_id)
      );

      -- Crear tabla de mensajes de chat
      CREATE TABLE IF NOT EXISTS public.chat_messages (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
          sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          is_read BOOLEAN DEFAULT FALSE,
          read_at TIMESTAMP WITH TIME ZONE
      );

      -- Crear tabla de consultas de soporte
      CREATE TABLE IF NOT EXISTS public.chat_support_queries (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          query_type VARCHAR(50) NOT NULL DEFAULT 'general',
          subject VARCHAR(255),
          content TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          response TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Crear tabla de estado de usuarios
      CREATE TABLE IF NOT EXISTS public.chat_user_status (
          user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          is_online BOOLEAN DEFAULT FALSE,
          last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          status_message TEXT,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Crear índices
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_1 ON public.chat_conversations(participant_1_id);
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_participant_2 ON public.chat_conversations(participant_2_id);
      CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message ON public.chat_conversations(last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON public.chat_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON public.chat_messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_support_queries_user ON public.chat_support_queries(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_support_queries_status ON public.chat_support_queries(status);
      CREATE INDEX IF NOT EXISTS idx_chat_user_status_online ON public.chat_user_status(is_online);

      -- Función para actualizar updated_at
      CREATE OR REPLACE FUNCTION public.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Triggers para updated_at
      CREATE TRIGGER update_chat_conversations_updated_at 
          BEFORE UPDATE ON public.chat_conversations 
          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

      CREATE TRIGGER update_chat_support_queries_updated_at 
          BEFORE UPDATE ON public.chat_support_queries 
          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

      CREATE TRIGGER update_chat_user_status_updated_at 
          BEFORE UPDATE ON public.chat_user_status 
          FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

      -- Función para actualizar last_message_at
      CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
      RETURNS TRIGGER AS $$
      BEGIN
          UPDATE public.chat_conversations 
          SET last_message_at = NEW.created_at 
          WHERE id = NEW.conversation_id;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Trigger para actualizar last_message_at
      CREATE TRIGGER update_conversation_last_message_trigger
          AFTER INSERT ON public.chat_messages
          FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

      -- Habilitar RLS
      ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chat_support_queries ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.chat_user_status ENABLE ROW LEVEL SECURITY;

      -- Políticas RLS para chat_conversations
      CREATE POLICY "Users can view their own conversations" ON public.chat_conversations
          FOR SELECT USING (
              participant_1_id = auth.uid() OR participant_2_id = auth.uid()
          );

      CREATE POLICY "Users can create conversations" ON public.chat_conversations
          FOR INSERT WITH CHECK (
              participant_1_id = auth.uid() OR participant_2_id = auth.uid()
          );

      CREATE POLICY "Users can update their own conversations" ON public.chat_conversations
          FOR UPDATE USING (
              participant_1_id = auth.uid() OR participant_2_id = auth.uid()
          );

      -- Políticas RLS para chat_messages
      CREATE POLICY "Users can view messages in their conversations" ON public.chat_messages
          FOR SELECT USING (
              EXISTS (
                  SELECT 1 FROM public.chat_conversations 
                  WHERE id = conversation_id 
                  AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
              )
          );

      CREATE POLICY "Users can send messages in their conversations" ON public.chat_messages
          FOR INSERT WITH CHECK (
              sender_id = auth.uid() AND
              EXISTS (
                  SELECT 1 FROM public.chat_conversations 
                  WHERE id = conversation_id 
                  AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
              )
          );

      CREATE POLICY "Users can update their own messages" ON public.chat_messages
          FOR UPDATE USING (sender_id = auth.uid());

      -- Políticas RLS para chat_support_queries
      CREATE POLICY "Users can view their own support queries" ON public.chat_support_queries
          FOR SELECT USING (user_id = auth.uid());

      CREATE POLICY "Users can create support queries" ON public.chat_support_queries
          FOR INSERT WITH CHECK (user_id = auth.uid());

      CREATE POLICY "Users can update their own support queries" ON public.chat_support_queries
          FOR UPDATE USING (user_id = auth.uid());

      -- Políticas RLS para chat_user_status
      CREATE POLICY "Users can view all user statuses" ON public.chat_user_status
          FOR SELECT USING (true);

      CREATE POLICY "Users can update their own status" ON public.chat_user_status
          FOR ALL USING (user_id = auth.uid());
    `;

    // Ejecutar el SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: createTablesSQL });

    if (error) {
      console.error('Error creando tablas:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Tablas de chat creadas exitosamente' 
    });

  } catch (error) {
    console.error('Error en create-chat-tables:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}
