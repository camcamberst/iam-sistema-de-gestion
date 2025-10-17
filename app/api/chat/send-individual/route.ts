import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

interface SendIndividualBody {
  message: string;
  targetUserId: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    // Obtener rol del usuario
    const { data: userRow } = await supabaseServer
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single();

    console.log('🔍 [SEND-INDIVIDUAL] User auth check:', { userId: user.id, userRow, role: userRow?.role });

    if (!userRow) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    const role = (userRow.role || '').toString();
    if (role !== 'admin' && role !== 'super_admin') {
      console.log('❌ [SEND-INDIVIDUAL] Role check failed:', { role, allowed: ['admin', 'super_admin'] });
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }

    const body = (await request.json()) as SendIndividualBody;
    const { message, targetUserId } = body;

    if (!message?.trim() || !targetUserId) {
      return NextResponse.json({ error: 'Mensaje y destinatario requeridos' }, { status: 400 });
    }

    // Verificar que el destinatario existe y es modelo
    const { data: targetUser } = await supabaseServer
      .from('users')
      .select('id, role')
      .eq('id', targetUserId)
      .single();
    
    if (!targetUser || targetUser.role !== 'modelo') {
      return NextResponse.json({ error: 'Destinatario no encontrado o no es modelo' }, { status: 404 });
    }

    // Crear/obtener sesión para el destinatario
    const sessionId = await getOrCreateSession(targetUserId);
    if (!sessionId) {
      return NextResponse.json({ error: 'Error creando sesión' }, { status: 500 });
    }

    // Insertar mensaje
    const { error: insertError } = await supabaseServer
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        sender_type: 'admin',
        sender_id: user.id,
        message: message.trim(),
        message_type: 'text'
      });

    if (insertError) {
      console.error('Error inserting message:', insertError);
      return NextResponse.json({ error: 'Error enviando mensaje' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Mensaje enviado' });
  } catch (e) {
    console.error('send-individual error', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function getOrCreateSession(userId: string): Promise<string | null> {
  const { data: existing } = await supabaseServer
    .from('chat_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabaseServer
    .from('chat_sessions')
    .insert({ user_id: userId, is_active: true })
    .select('id')
    .single();
  if (error) return null;
  return created?.id || null;
}
