import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const body = await request.json();
    const { targetUserId, message } = body;

    if (!targetUserId || !message) {
      return NextResponse.json({ error: 'targetUserId y message requeridos' }, { status: 400 });
    }

    // Crear/obtener sesión para el destinatario
    const { data: existing } = await supabaseServer
      .from('chat_sessions')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let sessionId;
    if (existing?.id) {
      sessionId = existing.id;
    } else {
      const { data: created, error } = await supabaseServer
        .from('chat_sessions')
        .insert({ user_id: targetUserId, is_active: true })
        .select('id')
        .single();
      
      if (error) {
        return NextResponse.json({ error: 'Error creando sesión' }, { status: 500 });
      }
      sessionId = created.id;
    }

    // Insertar mensaje de prueba
    const { error: insertError } = await supabaseServer
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender_type: 'admin',
        sender_id: user.id,
        message: message,
        message_type: 'text'
      });

    if (insertError) {
      return NextResponse.json({ error: 'Error insertando mensaje' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Mensaje de prueba enviado',
      sessionId,
      targetUserId 
    });

  } catch (e: any) {
    console.error('Error in /api/debug/test-realtime:', e);
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
  }
}
