import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    // Obtener las sesiones de chat para el usuario actual
    const { data: userSessions, error: sessionsError } = await supabaseServer
      .from('chat_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (sessionsError) {
      console.error('Error fetching user sessions for debug:', sessionsError);
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    if (!userSessions || userSessions.length === 0) {
      return NextResponse.json({ success: true, messages: [], count: 0, debug: 'No active sessions found for user' });
    }

    const sessionIds = userSessions.map(s => s.id);

    // Obtener los mensajes de esas sesiones
    const { data: chatMessages, error: messagesError } = await supabaseServer
      .from('chat_messages')
      .select('*')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching chat messages for debug:', messagesError);
      return NextResponse.json({ error: messagesError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, messages: chatMessages, count: chatMessages.length });

  } catch (e: any) {
    console.error('Error in /api/debug/chat-messages:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}