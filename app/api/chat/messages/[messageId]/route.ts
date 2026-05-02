import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function DELETE(
  request: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
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

    const messageId = params.messageId;
    if (!messageId) {
      return NextResponse.json({ error: 'Falta el ID del mensaje' }, { status: 400 });
    }

    // Verificar si el mensaje existe y es efímero
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select('id, sender_id, metadata, is_ephemeral')
      .eq('id', messageId)
      .single();

    if (messageError) {
      return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 });
    }

    // Solo permitir borrar si es efímero
    const isEphemeral = message.is_ephemeral || message.metadata?.is_ephemeral;
    if (!isEphemeral) {
      return NextResponse.json({ error: 'Solo se pueden borrar mensajes efímeros' }, { status: 403 });
    }

    // Opcional: Solo permitir a los participantes de la conversación, pero por ahora lo mantenemos simple.
    // Solo el remitente o el receptor deberían poder interactuar, 
    // pero al ser efímero, cualquiera que tenga acceso al chat debería poder verlo y que se destruya.

    // Destruir el mensaje
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true, message: 'Mensaje autodestruido correctamente' });
  } catch (error: any) {
    console.error('Error autodestruyendo mensaje efímero:', error);
    return NextResponse.json(
      { error: 'Error del servidor al autodestruir mensaje', details: error.message },
      { status: 500 }
    );
  }
}
