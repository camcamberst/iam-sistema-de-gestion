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

