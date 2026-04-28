import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

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
    const { action, conversation_id, user_id } = body;

    if (!conversation_id || !user_id || action !== 'add') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    // Verificar que el solicitante es parte de la conversación
    const { data: conv } = await supabase.from('chat_conversations').select('participant_1_id, participant_2_id').eq('id', conversation_id).single();
    if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    
    let isMember = conv.participant_1_id === user.id || conv.participant_2_id === user.id;
    if (!isMember) {
      const { data: groupCheck } = await supabase.from('chat_group_participants').select('id').eq('conversation_id', conversation_id).eq('user_id', user.id).single();
      if (groupCheck) isMember = true;
    }

    if (!isMember) {
      return NextResponse.json({ error: 'No tienes permiso para añadir participantes a este grupo' }, { status: 403 });
    }

    // Insertar en chat_group_participants
    const { error } = await supabase
      .from('chat_group_participants')
      .insert({
        conversation_id,
        user_id,
        added_by: user.id
      });

    if (error && error.code !== '23505') {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Usuario añadido al grupo correctamente' });

  } catch (error) {
    console.error('Error en POST /api/chat/conversations/participants:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
