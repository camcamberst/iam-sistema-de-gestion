import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface ChatPermission {
  allowed: boolean;
  reason?: string;
}

export interface UserInfo {
  id: string;
  role: string;
  groups?: string[];
}

/**
 * Valida si un usuario puede iniciar una conversación con otro usuario
 */
export async function validateConversationPermission(
  senderId: string, 
  receiverId: string
): Promise<ChatPermission> {
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Obtener información de ambos usuarios
    const { data: users, error } = await supabase
      .from('users')
      .select('id, role')
      .in('id', [senderId, receiverId]);

    if (error || !users || users.length !== 2) {
      return { allowed: false, reason: 'Error obteniendo información de usuarios' };
    }

    const sender = users.find(u => u.id === senderId);
    const receiver = users.find(u => u.id === receiverId);

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

      const senderGroupIds = senderGroups?.map(g => g.group_id) || [];
      const receiverGroupIds = receiverGroups?.map(g => g.group_id) || [];

      const hasCommonGroup = senderGroupIds.some(id => receiverGroupIds.includes(id));

      if (hasCommonGroup) {
        return { allowed: true };
      } else {
        return { allowed: false, reason: 'No pertenecen al mismo grupo' };
      }
    }

    return { allowed: false, reason: 'No tiene permisos para iniciar esta conversación' };
    
  } catch (error) {
    console.error('Error validando permisos de conversación:', error);
    return { allowed: false, reason: 'Error interno' };
  }
}

/**
 * Obtiene los usuarios disponibles para chat según el rol del usuario actual
 */
export async function getAvailableUsers(currentUserId: string): Promise<UserInfo[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Obtener información del usuario actual
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', currentUserId)
      .single();

    if (userError || !currentUser) {
      return [];
    }

    let availableUsers: UserInfo[] = [];

    if (currentUser.role === 'super_admin') {
      // Super admin puede ver todos los usuarios
      const { data: allUsers } = await supabase
        .from('users')
        .select('id, role')
        .neq('id', currentUserId)
        .eq('is_active', true);

      availableUsers = allUsers || [];
    } else if (currentUser.role === 'admin') {
      // Admin puede ver super admin y usuarios de su mismo grupo
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', currentUserId);

      const groupIds = userGroups?.map(g => g.group_id) || [];

      // Obtener super admin
      const { data: superAdmin } = await supabase
        .from('users')
        .select('id, role')
        .eq('role', 'super_admin')
        .eq('is_active', true)
        .single();

      // Obtener usuarios del mismo grupo
      let groupUsers: UserInfo[] = [];
      if (groupIds.length > 0) {
        const { data: usersInGroups } = await supabase
          .from('user_groups')
          .select(`
            user_id,
            users!inner(id, role)
          `)
          .in('group_id', groupIds)
          .neq('user_id', currentUserId);

        groupUsers = usersInGroups?.map(ug => ug.users).filter(Boolean) || [];
      }

      availableUsers = [
        ...(superAdmin ? [superAdmin] : []),
        ...groupUsers
      ];
    } else if (currentUser.role === 'modelo') {
      // Modelo puede ver admin de su mismo grupo
      const { data: userGroups } = await supabase
        .from('user_groups')
        .select('group_id')
        .eq('user_id', currentUserId);

      const groupIds = userGroups?.map(g => g.group_id) || [];

      if (groupIds.length > 0) {
        const { data: adminsInGroups } = await supabase
          .from('user_groups')
          .select(`
            user_id,
            users!inner(id, role)
          `)
          .in('group_id', groupIds)
          .eq('users.role', 'admin')
          .eq('users.is_active', true);

        availableUsers = adminsInGroups?.map(ug => ug.users).filter(Boolean) || [];
      }
    }

    return availableUsers;
    
  } catch (error) {
    console.error('Error obteniendo usuarios disponibles:', error);
    return [];
  }
}

/**
 * Verifica si un usuario puede acceder a una conversación específica
 */
export async function canAccessConversation(
  userId: string, 
  conversationId: string
): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .select('participant_1_id, participant_2_id')
      .eq('id', conversationId)
      .single();

    if (error || !conversation) {
      return false;
    }

    return conversation.participant_1_id === userId || conversation.participant_2_id === userId;
    
  } catch (error) {
    console.error('Error verificando acceso a conversación:', error);
    return false;
  }
}
