import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AIM_BOTTY_ID, isBottyId } from '@/lib/chat/aim-botty';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET: Obtener mensajes de una conversación
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Obtener token de autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autorización requerido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!conversationId) {
      return NextResponse.json({ error: 'ID de conversación requerido' }, { status: 400 });
    }

    // Verificar que el usuario tiene acceso a esta conversación
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id, participant_1_id, participant_2_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    if (conversation.participant_1_id !== user.id && conversation.participant_2_id !== user.id) {
      return NextResponse.json({ error: 'No tienes acceso a esta conversación' }, { status: 403 });
    }

    // Obtener mensajes
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        message_type,
        created_at,
        is_read,
        read_at,
        sender_id,
        sender:sender_id(id, name, email, role)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error obteniendo mensajes:', error);
      return NextResponse.json({ error: 'Error obteniendo mensajes' }, { status: 500 });
    }

    // Marcar mensajes como leídos
    const unreadMessageIds = messages
      .filter((msg: any) => !msg.is_read && msg.sender_id !== user.id)
      .map((msg: any) => msg.id);

    if (unreadMessageIds.length > 0) {
      await supabase
        .from('chat_messages')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .in('id', unreadMessageIds);
    }

    return NextResponse.json({ 
      success: true, 
      messages: messages.reverse(), // Ordenar cronológicamente
      has_more: messages.length === limit
    });

  } catch (error) {
    console.error('Error en GET /api/chat/messages:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Enviar mensaje
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Obtener token de autorización
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token de autorización requerido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const body = await request.json();
    const { conversation_id, content, message_type = 'text' } = body;

    if (!conversation_id || !content?.trim()) {
      return NextResponse.json({ 
        error: 'ID de conversación y contenido requeridos' 
      }, { status: 400 });
    }

    // Verificar que el usuario tiene acceso a esta conversación
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id, participant_1_id, participant_2_id, is_active')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    if (!conversation.is_active) {
      return NextResponse.json({ error: 'Conversación inactiva' }, { status: 400 });
    }

    if (conversation.participant_1_id !== user.id && conversation.participant_2_id !== user.id) {
      return NextResponse.json({ error: 'No tienes acceso a esta conversación' }, { status: 403 });
    }

    // Crear mensaje
    console.log('📤 [API] Creando mensaje:', {
      conversation_id,
      sender_id: user.id,
      content: content.trim(),
      message_type
    });

    const { data: newMessage, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversation_id,
        sender_id: user.id,
        content: content.trim(),
        message_type: message_type
      })
      .select(`
        id,
        content,
        message_type,
        created_at,
        sender_id,
        sender:sender_id(id, name, email, role)
      `)
      .single();

    if (error) {
      console.error('❌ [API] Error creando mensaje:', error);
      return NextResponse.json({ error: 'Error enviando mensaje' }, { status: 500 });
    }

    console.log('✅ [API] Mensaje creado exitosamente:', newMessage);

    // Verificar si el mensaje es para AIM Botty y generar respuesta automática
    const isToBotty = isBottyId(conversation.participant_1_id) || isBottyId(conversation.participant_2_id);
    
    console.log('🤖 [BOTTY] Verificando si mensaje es para el bot:', {
      isToBotty,
      participant_1: conversation.participant_1_id,
      participant_2: conversation.participant_2_id,
      botId: AIM_BOTTY_ID
    });
    
    if (isToBotty) {
      console.log('🤖 [BOTTY] Mensaje detectado para el bot, generando respuesta...');
      
      // Obtener historial de conversación (últimos 10 mensajes)
      const { data: conversationHistory, error: historyError } = await supabase
        .from('chat_messages')
        .select('id, sender_id, content, created_at')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (historyError) {
        console.error('❌ [BOTTY] Error obteniendo historial:', historyError);
      }

      // Determinar URL base
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                     process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                     'http://localhost:3000';
      
      const bottyUrl = `${baseUrl}/api/chat/aim-botty`;
      
      console.log('🤖 [BOTTY] Llamando a:', bottyUrl);

      // Generar respuesta del bot en segundo plano (no bloquea la respuesta)
      fetch(bottyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id,
          message_content: content.trim(),
          conversation_history: (conversationHistory || []).reverse()
        })
      })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [BOTTY] Error en respuesta del servidor:', response.status, errorText);
        } else {
          const data = await response.json();
          console.log('✅ [BOTTY] Respuesta del bot generada exitosamente:', data);
        }
      })
      .catch(error => {
        console.error('❌ [BOTTY] Error generando respuesta del bot:', error);
      });
    }

    // Actualizar estado de usuario en línea
    await supabase
      .from('chat_user_status')
      .upsert({
        user_id: user.id,
        is_online: true,
        last_seen: new Date().toISOString()
      });

    return NextResponse.json({ 
      success: true, 
      message: newMessage 
    });

  } catch (error) {
    console.error('Error en POST /api/chat/messages:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
