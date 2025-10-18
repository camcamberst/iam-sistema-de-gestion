import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    // Obtener todos los mensajes de chat recientes (últimos 10)
    const { data: recentMessages, error } = await supabaseServer
      .from('chat_messages')
      .select(`
        *,
        session:chat_sessions!inner(user_id),
        sender:users!chat_messages_sender_id_fkey(name, email, role)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Obtener todas las sesiones activas
    const { data: activeSessions, error: sessionsError } = await supabaseServer
      .from('chat_sessions')
      .select(`
        *,
        user:users!inner(name, email, role)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      recentMessages,
      activeSessions,
      totalMessages: recentMessages.length,
      totalSessions: activeSessions.length
    });

  } catch (e: any) {
    console.error('Error in /api/debug/simple-debug:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
