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
    const { action, message_id } = body;

    if (!message_id || !action) {
      return NextResponse.json({ error: 'message_id y action son requeridos' }, { status: 400 });
    }

    if (action === 'delete_for_me') {
      const { error } = await supabase
        .from('chat_hidden_messages')
        .insert({ user_id: user.id, message_id });
      if (error && error.code !== '23505') throw error; // Ignore unique constraint violation
      return NextResponse.json({ success: true, message: 'Mensaje eliminado para mí' });
    }

    if (action === 'delete_for_all') {
      // Verificar que el usuario sea el remitente
      const { data: msg } = await supabase.from('chat_messages').select('sender_id').eq('id', message_id).single();
      if (!msg || msg.sender_id !== user.id) {
        return NextResponse.json({ error: 'No autorizado para eliminar este mensaje' }, { status: 403 });
      }

      const { error } = await supabase
        .from('chat_messages')
        .update({ is_deleted_for_all: true })
        .eq('id', message_id);
        
      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Mensaje eliminado para todos' });
    }

    if (action === 'mark_ephemeral_viewed') {
      // 1. Obtener el mensaje para verificar que no esté ya visto y obtener su contenido (URL del archivo)
      const { data: msg } = await supabase
        .from('chat_messages')
        .select('content, metadata, sender_id')
        .eq('id', message_id)
        .single();

      if (!msg) {
        return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
      }

      // No permitir que el remitente lo marque como visto (o si ya se vio, no hacer nada)
      if (msg.sender_id === user.id) {
        return NextResponse.json({ error: 'El remitente no puede marcar el mensaje como visto' }, { status: 403 });
      }

      const metadata = msg.metadata || {};
      
      // Si ya fue visto, retornar OK sin hacer nada
      if (metadata.hasBeenViewed) {
        return NextResponse.json({ success: true, message: 'El mensaje ya fue visto' });
      }

      // 2. Actualizar metadata marcando hasBeenViewed: true
      const newMetadata = { ...metadata, hasBeenViewed: true };
      const { error: updateError } = await supabase
        .from('chat_messages')
        .update({ metadata: newMetadata })
        .eq('id', message_id);

      if (updateError) throw updateError;

      // 3. Eliminar el archivo físico de Supabase Storage para liberar espacio
      if (msg.content && msg.content.includes('/chat-attachments/')) {
        const filePath = msg.content.split('/chat-attachments/')[1];
        if (filePath) {
          // Extraemos la primera parte (el nombre de archivo puede tener signos raros, pero lo subimos limpio)
          // El decodeURIComponent asegura que espacios o caracteres especiales no fallen
          const decodedPath = decodeURIComponent(filePath);
          const { error: deleteError } = await supabase.storage
            .from('chat-attachments')
            .remove([decodedPath]);
            
          if (deleteError) {
            console.error('Error eliminando archivo efímero de storage:', deleteError);
            // No tiramos error general porque ya marcamos el mensaje como visto
          }
        }
      }

      return NextResponse.json({ success: true, message: 'Mensaje marcado como visto y archivo eliminado' });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });

  } catch (error) {
    console.error('Error en POST /api/chat/messages/action:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
