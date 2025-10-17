import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    // Obtener todas las sesiones de chat para el usuario
    const { data: sessions, error: sessionsError } = await supabaseServer
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return NextResponse.json({ error: 'Error fetching sessions' }, { status: 500 });
    }

    // Obtener todos los mensajes de esas sesiones
    const sessionIds = sessions?.map(s => s.id) || [];
    
    const { data: messages, error: messagesError } = await supabaseServer
      .from('chat_messages')
      .select(`
        *,
        chat_sessions!inner(user_id)
      `)
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: 'Error fetching messages' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      userId: user.id,
      sessions: sessions || [],
      messages: messages || [],
      sessionIds,
      count: messages?.length || 0
    });

  } catch (e) {
    console.error('Error in debug chat-messages:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
