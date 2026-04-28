import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from '@/lib/chat/aim-botty';

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

    // 1. Encontrar en qué grupos estoy
    const { data: myGroups } = await supabase
      .from('chat_group_participants')
      .select('conversation_id')
      .eq('user_id', user.id);
      
    const groupIds = myGroups?.map(g => g.conversation_id) || [];
    const groupFilter = groupIds.length > 0 ? `,id.in.(${groupIds.join(',')})` : '';

    // Obtener conversaciones del usuario (directas o grupos)
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
        participant_1:participant_1_id(id, name, email, role, avatar_url),
        participant_2:participant_2_id(id, name, email, role, avatar_url)
      `)
      .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}${groupFilter}`)
      .eq('is_active', true)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo conversaciones:', error);
      return NextResponse.json({ error: 'Error obteniendo conversaciones' }, { status: 500 });
    }

    // ⚡ OPTIMIZADO: Batch queries en vez de N+1
    // Antes: 3 queries POR conversación (3N total)
    // Ahora: 3 queries TOTAL para todas las conversaciones
    const conversationIds = conversations.map((c: any) => c.id);

    // BATCH 1: Últimos mensajes de TODAS las conversaciones (1 query)
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('id, content, created_at, sender_id, conversation_id, is_broadcast, no_reply, metadata')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: false })
      .limit(conversationIds.length * 3);

    // Deduplicar: quedarse con el mensaje más reciente por conversación
    const lastMessageMap = new Map();
    for (const msg of (recentMessages || [])) {
      if (!lastMessageMap.has(msg.conversation_id)) {
        lastMessageMap.set(msg.conversation_id, msg);
      }
    }

    // BATCH 2: Mensajes de otros usuarios en TODAS las conversaciones (1 query)
    const { data: allOtherMessages } = await supabase
      .from('chat_messages')
      .select('id, conversation_id')
      .in('conversation_id', conversationIds)
      .neq('sender_id', user.id);

    // BATCH 3: Lecturas del usuario actual (1 query)
    const allOtherMsgIds = (allOtherMessages || []).map(m => m.id);
    let readMessageIdSet = new Set<string>();
    if (allOtherMsgIds.length > 0) {
      // Chunks de 500 para evitar límites del IN clause
      const chunkSize = 500;
      for (let i = 0; i < allOtherMsgIds.length; i += chunkSize) {
        const chunk = allOtherMsgIds.slice(i, i + chunkSize);
        const { data: readRecords } = await supabase
          .from('chat_message_reads')
          .select('message_id')
          .eq('user_id', user.id)
          .in('message_id', chunk);
        for (const r of (readRecords || [])) {
          readMessageIdSet.add(r.message_id);
        }
      }
    }

    // Calcular unread counts por conversación en JS
    const unreadCountMap = new Map<string, number>();
    for (const msg of (allOtherMessages || [])) {
      if (!readMessageIdSet.has(msg.id)) {
        unreadCountMap.set(msg.conversation_id, (unreadCountMap.get(msg.conversation_id) || 0) + 1);
      }
    }

    // BATCH 4: Obtener participantes extra para grupos
    const { data: extraParticipants } = await supabase
      .from('chat_group_participants')
      .select('conversation_id, user:user_id(id, name, email, role, avatar_url)')
      .in('conversation_id', conversationIds);

    // Mapear participantes extra por conversación
    const groupParticipantsMap = new Map();
    for (const ep of (extraParticipants || [])) {
      if (!groupParticipantsMap.has(ep.conversation_id)) {
        groupParticipantsMap.set(ep.conversation_id, []);
      }
      groupParticipantsMap.get(ep.conversation_id).push(ep.user);
    }

    // Construir resultado final
    const conversationsWithLastMessage = conversations.map((conv: any) => {
      // Extra_participants array
      const extras = groupParticipantsMap.get(conv.id) || [];
      
      let otherParticipant;
      if (extras.length > 0) {
        // En frontend usaremos otros para construir el nombre del grupo
        otherParticipant = conv.participant_1_id === user.id ? conv.participant_2 : conv.participant_1;
      } else {
        otherParticipant = conv.participant_1_id === user.id ? conv.participant_2 : conv.participant_1;
      }

      const lastMessage = lastMessageMap.get(conv.id) || null;
      const unread_count = unreadCountMap.get(conv.id) || 0;

      const convWith = {
        ...conv,
        other_participant: otherParticipant,
        extra_participants: extras,
        last_message: lastMessage,
        unread_count
      } as any;

      // Excluir conversaciones de solo difusión (no_reply) generadas por Botty para receptores
      if (
        convWith.last_message &&
        (convWith.last_message as any).is_broadcast &&
        (convWith.last_message as any).no_reply &&
        (convWith.last_message as any).sender_id === AIM_BOTTY_ID &&
        !((convWith.last_message as any).metadata && (convWith.last_message as any).metadata.summary === true)
      ) {
        return null;
      }

      return convWith;
    });

    const filtered = conversationsWithLastMessage.filter(Boolean);

    return NextResponse.json({ 
      success: true, 
      conversations: filtered 
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
        participant_1:participant_1_id(id, name, email, role, avatar_url),
        participant_2:participant_2_id(id, name, email, role, avatar_url)
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
  
  // Obtener información de ambos usuarios (incluyendo affiliate_studio_id)
  const { data: users, error } = await supabase
    .from('users')
    .select('id, role, affiliate_studio_id')
    .in('id', [senderId, receiverId]);

  if (error || !users || users.length !== 2) {
    return { allowed: false, reason: 'Error obteniendo información de usuarios' };
  }

    const sender = users.find((u: any) => u.id === senderId);
    const receiver = users.find((u: any) => u.id === receiverId);

  if (!sender || !receiver) {
    return { allowed: false, reason: 'Usuario no encontrado' };
  }

  // ⛳ Override: Siempre permitir conversaciones con AIM Botty
  if (receiver.id === AIM_BOTTY_ID) {
    return { allowed: true };
  }

  // --- NUEVO: Validar si son contactos de Aurora PIN ---
  const { data: contact } = await supabase
    .from('chat_contacts')
    .select('status')
    .or(`and(user_id.eq.${senderId},contact_id.eq.${receiverId}),and(user_id.eq.${receiverId},contact_id.eq.${senderId})`)
    .eq('status', 'accepted')
    .single();

  if (contact) {
    return { allowed: true };
  }

  // Super admin puede iniciar conversación con cualquiera
  if (sender.role === 'super_admin') {
    return { allowed: true };
  }

  // Super admin puede recibir conversaciones de cualquiera
  if (receiver.role === 'super_admin') {
    return { allowed: true };
  }

  // Superadmin_aff puede conversar con modelos y admins de su mismo affiliate_studio_id
  if (sender.role === 'superadmin_aff' && sender.affiliate_studio_id) {
    if (receiver.affiliate_studio_id === sender.affiliate_studio_id && 
        (receiver.role === 'modelo' || receiver.role === 'admin')) {
      return { allowed: true };
    }
  }

  // Modelos y admins de afiliado pueden conversar con su superadmin_aff
  if ((sender.role === 'modelo' || sender.role === 'admin') && 
      sender.affiliate_studio_id && 
      receiver.role === 'superadmin_aff' && 
      receiver.affiliate_studio_id === sender.affiliate_studio_id) {
    return { allowed: true };
  }

  // Admin puede conversar con super admin
  if (sender.role === 'admin' && receiver.role === 'super_admin') {
    return { allowed: true };
  }

  // Admin puede conversar con otro admin
  if (sender.role === 'admin' && receiver.role === 'admin') {
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
