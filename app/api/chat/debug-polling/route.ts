import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
      return NextResponse.json({ 
        error: 'Token de autorización requerido',
        debug: 'No se encontró header Authorization'
      }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    console.log('🔍 [DEBUG-POLLING] Token recibido:', token.substring(0, 20) + '...');

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      console.error('❌ [DEBUG-POLLING] Error de autenticación:', authError);
      return NextResponse.json({ 
        error: 'Error de autenticación',
        debug: authError.message
      }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ 
        error: 'Usuario no encontrado',
        debug: 'Token válido pero sin usuario'
      }, { status: 401 });
    }

    console.log('✅ [DEBUG-POLLING] Usuario autenticado:', user.id);

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');

    if (!conversationId) {
      return NextResponse.json({ 
        error: 'ID de conversación requerido',
        debug: 'No se proporcionó conversation_id'
      }, { status: 400 });
    }

    // Verificar que el usuario tiene acceso a esta conversación
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id, participant_1_id, participant_2_id, created_at')
      .eq('id', conversationId)
      .single();

    if (convError) {
      console.error('❌ [DEBUG-POLLING] Error obteniendo conversación:', convError);
      return NextResponse.json({ 
        error: 'Error obteniendo conversación',
        debug: convError.message
      }, { status: 500 });
    }

    if (!conversation) {
      return NextResponse.json({ 
        error: 'Conversación no encontrada',
        debug: `Conversación ${conversationId} no existe`
      }, { status: 404 });
    }

    // Verificar permisos
    const hasAccess = conversation.participant_1_id === user.id || conversation.participant_2_id === user.id;
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Sin permisos para esta conversación',
        debug: `Usuario ${user.id} no es participante de conversación ${conversationId}`
      }, { status: 403 });
    }

    // Obtener mensajes
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id, content, sender_id, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('❌ [DEBUG-POLLING] Error obteniendo mensajes:', messagesError);
      return NextResponse.json({ 
        error: 'Error obteniendo mensajes',
        debug: messagesError.message
      }, { status: 500 });
    }

    const result = {
      success: true,
      debug: {
        userId: user.id,
        userEmail: user.email,
        conversationId,
        conversation: {
          id: conversation.id,
          participant_1_id: conversation.participant_1_id,
          participant_2_id: conversation.participant_2_id,
          created_at: conversation.created_at
        },
        messagesCount: messages?.length || 0,
        lastMessage: messages && messages.length > 0 ? {
          id: messages[messages.length - 1].id,
          content: messages[messages.length - 1].content.substring(0, 50) + '...',
          sender_id: messages[messages.length - 1].sender_id,
          created_at: messages[messages.length - 1].created_at
        } : null,
        timestamp: new Date().toISOString()
      }
    };

    console.log('✅ [DEBUG-POLLING] Diagnóstico exitoso:', result.debug);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ [DEBUG-POLLING] Error general:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      debug: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
}
