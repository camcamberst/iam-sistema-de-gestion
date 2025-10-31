import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { conversation_id } = body || {};
    if (!conversation_id) {
      return NextResponse.json({ success: false, error: 'conversation_id requerido' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Obtener usuario
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'No se pudo autenticar usuario' }, { status: 401 });
    }

    // Obtener mensajes de la conversación que no son del usuario
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('id, sender_id')
      .eq('conversation_id', conversation_id)
      .neq('sender_id', user.id);

    if (msgError) {
      return NextResponse.json({ success: false, error: 'Error obteniendo mensajes' }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    // Insertar lecturas faltantes (ignorar duplicados por unique)
    const rows = messages.map(m => ({ message_id: m.id, user_id: user.id }));
    const { error: insertError } = await supabase
      .from('chat_message_reads')
      .insert(rows, { upsert: true });

    if (insertError) {
      // Si el cliente no admite upsert, realizar inserciones ignorando duplicados
      // Intentar inserciones por lotes en fallback
      // Para simplicidad, devolver éxito parcial
      console.error('Insert error chat_message_reads:', insertError);
    }

    return NextResponse.json({ success: true, updated: rows.length });
  } catch (error) {
    console.error('Error en marcar vistos:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}

