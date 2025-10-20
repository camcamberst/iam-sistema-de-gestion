import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET: Obtener conversaciones del usuario
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
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

    // Obtener conversaciones del usuario
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select(`
        id,
        participant_1_id,
        participant_2_id,
        created_at,
        last_message_at,
        is_active,
        conversation_type,
        participant_1:participant_1_id(id, name, email, role),
        participant_2:participant_2_id(id, name, email, role)
      `)
      .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)
      .eq('is_active', true)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo conversaciones:', error);
      return NextResponse.json({ error: 'Error obteniendo conversaciones' }, { status: 500 });
    }

    // Obtener último mensaje de cada conversación
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const { data: lastMessage } = await supabase
          .from('chat_messages')
          .select('content, created_at, sender_id')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Determinar el otro participante
        const otherParticipant = conv.participant_1_id === user.id 
          ? conv.participant_2 
          : conv.participant_1;

        return {
          ...conv,
          other_participant: otherParticipant,
          last_message: lastMessage
        };
      })
    );

    return NextResponse.json({ 
      success: true, 
      conversations: conversationsWithLastMessage 
    });

  } catch (error) {
    console.error('Error en GET /api/chat/conversations:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST: Crear nueva conversación
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
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

    const body = await request.json();
    const { participant_2_id, conversation_type = 'direct' } = body;

    if (!participant_2_id) {
      return NextResponse.json({ error: 'ID del participante requerido' }, { status: 400 });
    }

    // Validar permisos de conversación
    const canCreateConversation = await validateConversationPermission(
      supabase, 
      user.id, 
      participant_2_id
    );

    if (!canCreateConversation.allowed) {
      return NextResponse.json({ 
        error: canCreateConversation.reason 
      }, { status: 403 });
    }

    // Verificar si ya existe una conversación
    const { data: existingConversation } = await supabase
      .from('chat_conversations')
      .select('id')
      .or(`and(participant_1_id.eq.${user.id},participant_2_id.eq.${participant_2_id}),and(participant_1_id.eq.${participant_2_id},participant_2_id.eq.${user.id})`)
      .eq('is_active', true)
      .single();

    if (existingConversation) {
      return NextResponse.json({ 
        success: true, 
        conversation: existingConversation,
        message: 'Conversación ya existe'
      });
    }

    // Crear nueva conversación
    const { data: newConversation, error } = await supabase
      .from('chat_conversations')
      .insert({
        participant_1_id: user.id,
        participant_2_id: participant_2_id,
        conversation_type: conversation_type
      })
      .select(`
        id,
        participant_1_id,
        participant_2_id,
        created_at,
        conversation_type,
        participant_1:participant_1_id(id, name, email, role),
        participant_2:participant_2_id(id, name, email, role)
      `)
      .single();

    if (error) {
      console.error('Error creando conversación:', error);
      return NextResponse.json({ error: 'Error creando conversación' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      conversation: newConversation 
    });

  } catch (error) {
    console.error('Error en POST /api/chat/conversations:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// Función para validar permisos de conversación
async function validateConversationPermission(
  supabase: any, 
  senderId: string, 
  receiverId: string
): Promise<{ allowed: boolean; reason?: string }> {
  
  // Obtener información de ambos usuarios
  const { data: users, error } = await supabase
    .from('users')
    .select('id, role')
    .in('id', [senderId, receiverId]);

  if (error || !users || users.length !== 2) {
    return { allowed: false, reason: 'Error obteniendo información de usuarios' };
  }

    const sender = users.find((u: any) => u.id === senderId);
    const receiver = users.find((u: any) => u.id === receiverId);

  if (!sender || !receiver) {
    return { allowed: false, reason: 'Usuario no encontrado' };
  }

  // Super admin puede iniciar conversación con cualquiera
  if (sender.role === 'super_admin') {
    return { allowed: true };
  }

  // Super admin puede recibir conversaciones de cualquiera
  if (receiver.role === 'super_admin') {
    return { allowed: true };
  }

  // Admin puede conversar con super admin
  if (sender.role === 'admin' && receiver.role === 'super_admin') {
    return { allowed: true };
  }

  // Verificar si pertenecen al mismo grupo (para modelo-admin)
  if ((sender.role === 'modelo' && receiver.role === 'admin') || 
      (sender.role === 'admin' && receiver.role === 'modelo')) {
    
    const { data: senderGroups } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', senderId);

    const { data: receiverGroups } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', receiverId);

      const senderGroupIds = senderGroups?.map((g: any) => g.group_id) || [];
      const receiverGroupIds = receiverGroups?.map((g: any) => g.group_id) || [];

    const hasCommonGroup = senderGroupIds.some((id: any) => receiverGroupIds.includes(id));

    if (hasCommonGroup) {
      return { allowed: true };
    } else {
      return { allowed: false, reason: 'No pertenecen al mismo grupo' };
    }
  }

  return { allowed: false, reason: 'No tiene permisos para iniciar esta conversación' };
}

// DELETE: Eliminar conversación
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
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

    // Obtener ID de conversación de la query string
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversation_id');
    
    if (!conversationId) {
      return NextResponse.json({ error: 'ID de conversación requerido' }, { status: 400 });
    }

    // Verificar que el usuario es participante de la conversación
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('id, participant_1_id, participant_2_id')
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    if (conversation.participant_1_id !== user.id && conversation.participant_2_id !== user.id) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar esta conversación' }, { status: 403 });
    }

    // Eliminar la conversación (esto también eliminará los mensajes por CASCADE)
    const { error: deleteError } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId);

    if (deleteError) {
      console.error('Error eliminando conversación:', deleteError);
      return NextResponse.json({ error: 'Error eliminando conversación' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Conversación eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error en DELETE conversación:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
