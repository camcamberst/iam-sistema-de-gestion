import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AIM_BOTTY_ID, isBottyId } from '@/lib/chat/aim-botty';
import { processBotResponse } from '@/lib/chat/process-bot-response';

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

    // Obtener mensajes con información de reply
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        message_type,
        created_at,
        sender_id,
        reply_to_message_id,
        is_deleted_for_all,
        metadata,
        sender:sender_id(id, name, email, role),
        reply_to_message:reply_to_message_id(
          id,
          content,
          sender:sender_id(name)
        )
      `)
      .eq('conversation_id', conversationId)
      .eq('is_deleted_for_all', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo mensajes:', error);
      return NextResponse.json({ error: 'Error obteniendo mensajes' }, { status: 500 });
    }

    // Obtener fecha de vaciado de chat
    const { data: cleared } = await supabase
      .from('chat_cleared_history')
      .select('cleared_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single();

    // Obtener mensajes ocultos (eliminados para mí)
    const { data: hidden } = await supabase
      .from('chat_hidden_messages')
      .select('message_id')
      .eq('user_id', user.id);

    const hiddenIds = new Set(hidden?.map(h => h.message_id) || []);
    const clearedAt = cleared ? new Date(cleared.cleared_at) : new Date(0);

    // Filtrar localmente (ya que range/offset es difícil de combinar con filtros complejos en Supabase)
    const validMessages = messages.filter((m: any) => {
      const msgDate = new Date(m.created_at);
      return msgDate > clearedAt && !hiddenIds.has(m.id);
    });

    const paginatedMessages = validMessages.slice(offset, offset + limit);

    if (error) {
      console.error('Error obteniendo mensajes:', error);
      return NextResponse.json({ error: 'Error obteniendo mensajes' }, { status: 500 });
    }

    // Determinar participantes para lecturas
    const otherParticipantId = conversation.participant_1_id === user.id 
      ? conversation.participant_2_id 
      : conversation.participant_1_id;

    // Obtener qué mensajes fueron leídos por ambos participantes
    const messageIds = paginatedMessages.map((m: any) => m.id);
    
    // Lecturas del otro participante (para mostrar "visto" en mensajes que yo envié)
    const { data: readByOther } = await supabase
      .from('chat_message_reads')
      .select('message_id')
      .eq('user_id', otherParticipantId)
      .in('message_id', messageIds);

    // Lecturas del usuario actual (para mensajes que recibí)
    const { data: readByMe } = await supabase
      .from('chat_message_reads')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', messageIds);

    const readByOtherSet = new Set(readByOther?.map((r: any) => r.message_id) || []);
    const readByMeSet = new Set(readByMe?.map((r: any) => r.message_id) || []);

    // Enriquecer mensajes con flags de lectura
    const messagesWithReadStatus = paginatedMessages.map((msg: any) => {
      const isMyMessage = msg.sender_id === user.id;
      
      return {
        ...msg,
        // Si es mi mensaje: mostrar si fue leído por el otro
        is_read_by_other: isMyMessage ? readByOtherSet.has(msg.id) : false,
        // Si es mensaje recibido: mostrar si lo leí yo
        is_read_by_me: !isMyMessage ? readByMeSet.has(msg.id) : false
      };
    });

    // ELIMINADO: Marcar automáticamente como leído aquí causa problemas de sincronización
    // El marcado debe hacerse explícitamente cuando el usuario abre la conversación
    // vía /api/chat/messages/read para evitar race conditions y duplicados

    return NextResponse.json({ 
      success: true, 
      messages: messagesWithReadStatus.reverse(), // Ordenar cronológicamente
      has_more: validMessages.length > offset + limit
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
    const { conversation_id, content, message_type = 'text', reply_to_message_id, is_forwarded = false, metadata = null, is_ephemeral = false, media_url = null } = body;

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

    let isParticipant = conversation.participant_1_id === user.id || conversation.participant_2_id === user.id;

    if (!isParticipant) {
      const { data: groupCheck } = await supabase.from('chat_group_participants').select('id').eq('conversation_id', conversation_id).eq('user_id', user.id).single();
      if (groupCheck) isParticipant = true;
    }

    if (!isParticipant) {
      return NextResponse.json({ error: 'No tienes acceso a esta conversación' }, { status: 403 });
    }

    const receiverId = conversation.participant_1_id === user.id ? conversation.participant_2_id : conversation.participant_1_id;

    // Verificar bloqueos
    const { data: block } = await supabase
      .from('chat_blocks')
      .select('id')
      .or(`and(blocker_id.eq.${receiverId},blocked_id.eq.${user.id}),and(blocker_id.eq.${user.id},blocked_id.eq.${receiverId})`)
      .limit(1);

    if (block && block.length > 0) {
      return NextResponse.json({ error: 'No puedes enviar mensajes a este contacto.' }, { status: 403 });
    }

    // Bloqueo: si el último mensaje fue una difusión no respondible enviada por Botty,
    // no permitir que el receptor responda directamente.
    try {
      const { data: lastMsg } = await supabase
        .from('chat_messages')
        .select('id, sender_id, is_broadcast, no_reply, created_at')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMsg && (lastMsg as any).is_broadcast && (lastMsg as any).no_reply && lastMsg.sender_id === AIM_BOTTY_ID) {
        return NextResponse.json({ error: 'Este mensaje es informativo y no admite respuestas.' }, { status: 400 });
      }
    } catch {}

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
        content: message_type === 'voice' && media_url ? media_url : content.trim(),
        message_type: message_type,
        reply_to_message_id: reply_to_message_id || null,
        metadata: {
          ...(metadata || {}),
          ...(is_forwarded ? { is_forwarded: true } : {}),
          ...(is_ephemeral ? { is_ephemeral: true } : {})
        }
      })
      .select(`
        id,
        content,
        message_type,
        created_at,
        sender_id,
        reply_to_message_id,
        sender:sender_id(id, name, email, role),
        reply_to_message:reply_to_message_id(
          id,
          content,
          sender:sender_id(name)
        )
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

      // Procesar respuesta del bot directamente (sin fetch interno)
      // Esto evita problemas en Vercel/producción con fetch interno
      processBotResponse(
        user.id,
        conversation_id,
        content.trim(),
        (conversationHistory || []).reverse()
      ).then(success => {
        if (success) {
          console.log('✅ [BOTTY] Respuesta del bot generada exitosamente');
        } else {
          console.error('❌ [BOTTY] Error generando respuesta del bot');
        }
      }).catch(error => {
        console.error('❌ [BOTTY] Error en processBotResponse:', error);
      });
    }

    // Notificaciones nativas del sistema (sonidos, apertura automática) ya manejan las notificaciones
    // Botty no debe enviar notificaciones redundantes cuando usuarios se envían mensajes entre sí
    // Las notificaciones automáticas de Botty solo se usan para eventos del sistema (anticipos, plataformas, etc.)

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
