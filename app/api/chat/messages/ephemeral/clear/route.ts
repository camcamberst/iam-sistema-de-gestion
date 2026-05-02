import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
    const { conversation_id } = body;

    if (!conversation_id) {
      return NextResponse.json({ error: 'ID de conversación requerido' }, { status: 400 });
    }

    // Verificar que el usuario tiene acceso a esta conversación
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('participant_1_id, participant_2_id')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    const isParticipant = conversation.participant_1_id === user.id || conversation.participant_2_id === user.id;

    if (!isParticipant) {
      // Verificar si es un grupo
      const { data: groupCheck } = await supabase
        .from('chat_group_participants')
        .select('id')
        .eq('conversation_id', conversation_id)
        .eq('user_id', user.id)
        .single();
        
      if (!groupCheck) {
        return NextResponse.json({ error: 'No tienes acceso a esta conversación' }, { status: 403 });
      }
    }

    // Eliminar todos los mensajes efímeros de esta conversación
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversation_id)
      .contains('metadata', '{"is_ephemeral":true}');

    if (deleteError) {
      console.error('❌ [API] Error eliminando mensajes efímeros:', deleteError);
      return NextResponse.json({ error: 'Error eliminando mensajes' }, { status: 500 });
    }

    console.log('✅ [API] Mensajes efímeros eliminados exitosamente para conversación:', conversation_id);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error en POST /api/chat/messages/ephemeral/clear:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
