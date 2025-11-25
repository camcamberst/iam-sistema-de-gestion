// Sistema de Notificaciones Automáticas de AIM Botty
// ==================================================

import { createClient } from '@supabase/supabase-js';
import { 
  AIM_BOTTY_ID, 
  generateNotificationMessage,
  type NotificationType,
  type UserContext 
} from './aim-botty';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Enviar notificación automática a un usuario
export async function sendBotNotification(
  userId: string,
  notificationType: NotificationType,
  customMessage?: string
): Promise<boolean> {
  try {
    // Obtener contexto del usuario
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', userId)
      .single();

    if (!user) {
      console.error('Usuario no encontrado para notificación:', userId);
      return false;
    }

    // Obtener o crear conversación con el bot
    let conversationId = await getOrCreateBotConversation(userId);

    if (!conversationId) {
      console.error('No se pudo crear/obtener conversación con el bot');
      return false;
    }

    // Generar mensaje de notificación
    const userContext: UserContext = {
      userId: user.id,
      role: (user.role as any) || 'modelo',
      name: user.name || user.email?.split('@')[0] || 'Usuario',
      email: user.email || ''
    };

    const messageContent = customMessage || generateNotificationMessage(notificationType, userContext);

    // Crear mensaje del bot
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: AIM_BOTTY_ID,
        content: messageContent,
        message_type: 'ai_response'
      });

    if (error) {
      console.error('Error enviando notificación del bot:', error);
      return false;
    }

    console.log(`✅ Notificación enviada a ${user.name} (${notificationType})`);
    return true;

  } catch (error) {
    console.error('Error en sendBotNotification:', error);
    return false;
  }
}

// Obtener o crear conversación con el bot
async function getOrCreateBotConversation(userId: string): Promise<string | null> {
  try {
    // Buscar conversación existente
    const { data: existingConv } = await supabase
      .from('chat_conversations')
      .select('id')
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .or(`participant_1_id.eq.${AIM_BOTTY_ID},participant_2_id.eq.${AIM_BOTTY_ID}`)
      .single();

    if (existingConv) {
      return existingConv.id;
    }

    // Crear nueva conversación
    const { data: newConv, error } = await supabase
      .from('chat_conversations')
      .insert({
        participant_1_id: userId,
        participant_2_id: AIM_BOTTY_ID,
        conversation_type: 'direct'
      })
      .select('id')
      .single();

    if (error || !newConv) {
      console.error('Error creando conversación con el bot:', error);
      return null;
    }

    return newConv.id;

  } catch (error) {
    console.error('Error en getOrCreateBotConversation:', error);
    return null;
  }
}

// Enviar notificación de anticipo pendiente
export async function notifyAnticipoPending(userId: string, anticipoId: string): Promise<void> {
  await sendBotNotification(userId, 'anticipo_pendiente');
}

// Enviar notificación de anticipo aprobado
export async function notifyAnticipoApproved(userId: string): Promise<void> {
  await sendBotNotification(userId, 'anticipo_aprobado');
}

// Enviar notificación de anticipo rechazado
export async function notifyAnticipoRejected(userId: string): Promise<void> {
  await sendBotNotification(userId, 'anticipo_rechazado');
}

// Enviar notificación de página confirmada
export async function notifyPaginaConfirmed(userId: string): Promise<void> {
  await sendBotNotification(userId, 'pagina_confirmada');
}

// Enviar recordatorio de ingresar valores
export async function notifyCalculatorReminder(userId: string): Promise<void> {
  await sendBotNotification(userId, 'recordatorio_ingreso');
}

// Enviar notificación de nueva publicación
export async function notifyNewAnnouncement(
  userId: string, 
  announcementTitle?: string
): Promise<void> {
  const customMessage = announcementTitle 
    ? `📌 ¡Hola! Hay una nueva publicación en el corcho informativo: "${announcementTitle}". Revisa tu dashboard para ver los detalles.`
    : undefined;
  await sendBotNotification(userId, 'nueva_publicacion', customMessage);
}

// Notificar a admins cuando una modelo solicita un anticipo
export async function notifyAdminsAnticipoRequest(
  modelId: string,
  modelName: string,
  anticipoId: string,
  montoSolicitado: number
): Promise<void> {
  try {
    // Obtener información de la modelo
    const { data: model } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', modelId)
      .single();

    if (!model) {
      console.error('❌ [NOTIFY-ADMINS] Modelo no encontrada:', modelId);
      return;
    }

    // Obtener grupos de la modelo
    const { data: modelGroups } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', modelId);

    const groupIds = modelGroups?.map(g => g.group_id) || [];

    // Obtener admins que deben ser notificados
    let adminIds: string[] = [];

    if (groupIds.length > 0) {
      // Obtener admins de los grupos de la modelo
      const { data: adminGroups } = await supabase
        .from('user_groups')
        .select('user_id')
        .in('group_id', groupIds);

      const adminGroupUserIds = adminGroups?.map(ag => ag.user_id) || [];

      if (adminGroupUserIds.length > 0) {
        // Obtener usuarios que son admins de esos grupos
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .in('id', adminGroupUserIds)
          .in('role', ['admin', 'super_admin'])
          .eq('is_active', true);

        adminIds = admins?.map(a => a.id) || [];
      }
    }

    // También notificar a todos los super_admins
    const { data: superAdmins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'super_admin')
      .eq('is_active', true);

    const superAdminIds = superAdmins?.map(sa => sa.id) || [];
    
    // Combinar y eliminar duplicados
    const allAdminIds = [...new Set([...adminIds, ...superAdminIds])];

    if (allAdminIds.length === 0) {
      console.warn('⚠️ [NOTIFY-ADMINS] No se encontraron admins para notificar');
      return;
    }

    console.log(`📢 [NOTIFY-ADMINS] Notificando a ${allAdminIds.length} admin(s) sobre solicitud de anticipo:`, {
      modelId,
      modelName,
      anticipoId,
      montoSolicitado,
      adminIds: allAdminIds
    });

    // Formatear monto en COP
    const montoFormateado = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(montoSolicitado);

    // Notificar a cada admin
    const notificationPromises = allAdminIds.map(adminId => {
      const customMessage = `📋 Nueva solicitud de anticipo de **${modelName}** por ${montoFormateado}. Revisa la solicitud en "Gestión Anticipos > Solicitudes Pendientes".`;
      return sendBotNotification(adminId, 'anticipo_pendiente', customMessage);
    });

    await Promise.all(notificationPromises);
    console.log(`✅ [NOTIFY-ADMINS] Notificaciones enviadas a ${allAdminIds.length} admin(s)`);

  } catch (error) {
    console.error('❌ [NOTIFY-ADMINS] Error notificando admins:', error);
  }
}



