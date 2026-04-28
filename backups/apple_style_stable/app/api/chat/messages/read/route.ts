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

    // Obtener TODOS los mensajes de la conversación que no son del usuario
    // Usar select simple para mejor performance
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('conversation_id', conversation_id)
      .neq('sender_id', user.id);

    if (msgError) {
      console.error('❌ [API-READ] Error obteniendo mensajes:', msgError);
      return NextResponse.json({ success: false, error: 'Error obteniendo mensajes' }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const messageIds = messages.map(m => m.id);

    // Obtener mensajes ya leídos para evitar duplicados (una sola query)
    const { data: existingReads } = await supabase
      .from('chat_message_reads')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', messageIds);

    const existingMessageIds = new Set(existingReads?.map(r => r.message_id) || []);
    
    // Insertar solo lecturas faltantes (optimizado: insertar todos de una vez)
    const rowsToInsert = messageIds
      .filter(id => !existingMessageIds.has(id))
      .map(message_id => ({ message_id, user_id: user.id }));

    if (rowsToInsert.length > 0) {
      // Usar upsert con onConflict para evitar errores de duplicados (más robusto)
      // Ojo: chat_message_reads tiene (user_id, message_id) como unique constraint
      const { data: inserted, error: insertError } = await supabase
        .from('chat_message_reads')
        .upsert(rowsToInsert, { onConflict: 'user_id,message_id', ignoreDuplicates: true })
        .select('message_id');

      if (insertError) {
        // Si aún así falla, revisar el error pero no tumbar el proceso
        console.error('❌ [API-READ] Error insertando lecturas:', insertError);
        // Retornar success false pero con status 200 para que el frontend no reintente agresivamente si es un error de lógica
        // Solo 500 si es error crítico de conexión
        return NextResponse.json({ success: false, error: 'Error insertando lecturas' }, { status: 200 }); 
      }

      console.log(`✅ [API-READ] ${inserted?.length || 0} mensajes marcados como leídos`);
      return NextResponse.json({ success: true, updated: inserted?.length || 0 });
    }

    return NextResponse.json({ success: true, updated: 0 });
  } catch (error) {
    console.error('Error en marcar vistos:', error);
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 });
  }
}

