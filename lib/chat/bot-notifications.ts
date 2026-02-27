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

// =====================================================
// 🔔 FUNCIONES HELPER PARA NOTIFICACIONES
// =====================================================

// Función helper para obtener admins de un modelo
async function getAdminsForModel(modelId: string): Promise<string[]> {
  try {
    // Obtener grupos de la modelo
    const { data: modelGroups } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', modelId);

    const groupIds = modelGroups?.map(g => g.group_id) || [];
    let adminIds: string[] = [];

    if (groupIds.length > 0) {
      const { data: adminGroups } = await supabase
        .from('user_groups')
        .select('user_id')
        .in('group_id', groupIds);

      const adminGroupUserIds = adminGroups?.map(ag => ag.user_id) || [];

      if (adminGroupUserIds.length > 0) {
        const { data: admins } = await supabase
          .from('users')
          .select('id')
          .in('id', adminGroupUserIds)
          .in('role', ['admin', 'super_admin'])
          .eq('is_active', true);

        adminIds = admins?.map(a => a.id) || [];
      }
    }

    // También incluir todos los super_admins
    const { data: superAdmins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'super_admin')
      .eq('is_active', true);

    const superAdminIds = superAdmins?.map(sa => sa.id) || [];
    
    return Array.from(new Set([...adminIds, ...superAdminIds]));
  } catch (error) {
    console.error('Error obteniendo admins:', error);
    return [];
  }
}

// =====================================================
// 💰 NOTIFICACIONES DE ANTICIPOS
// =====================================================

// Notificar a admins cuando una modelo solicita un anticipo
export async function notifyAdminsAnticipoRequest(
  modelId: string,
  modelName: string,
  anticipoId: string,
  montoSolicitado: number
): Promise<void> {
  try {
    const allAdminIds = await getAdminsForModel(modelId);

    if (allAdminIds.length === 0) {
      console.warn('⚠️ [NOTIFY-ADMINS] No se encontraron admins para notificar');
      return;
    }

    const montoFormateado = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(montoSolicitado);

    const notificationPromises = allAdminIds.map(adminId => {
      const customMessage = `📋 Nueva solicitud de anticipo de **${modelName}** por ${montoFormateado}. [LINK:Revisa la solicitud|/admin/anticipos/pending].`;
      return sendBotNotification(adminId, 'anticipo_pendiente', customMessage);
    });

    await Promise.all(notificationPromises);
    console.log(`✅ [NOTIFY-ADMINS] Notificaciones enviadas a ${allAdminIds.length} admin(s)`);
  } catch (error) {
    console.error('❌ [NOTIFY-ADMINS] Error notificando admins:', error);
  }
}

// Notificar anticipo realizado (pagado)
export async function notifyAnticipoRealizado(
  modelId: string,
  montoSolicitado: number
): Promise<void> {
  const montoFormateado = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(montoSolicitado);
  
  const customMessage = `💰 Tu anticipo de ${montoFormateado} ha sido pagado. Por favor [LINK:confirma la recepción|/admin/model/anticipos/solicitudes].`;
  await sendBotNotification(modelId, 'anticipo_realizado', customMessage);
}

// Notificar a la modelo que su anticipo fue reversado
export async function notifyAnticipoReversado(
  modelId: string,
  monto: number,
  motivo?: string
): Promise<void> {
  const montoFormateado = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(monto);

  const motivoTexto = motivo ? ` Motivo: ${motivo}.` : '';
  const customMessage =
    `🔄 Tu solicitud de anticipo por ${montoFormateado} ha sido **reversada** por el administrador.${motivoTexto} ` +
    `Este monto **no será descontado** de tu facturado. Si tienes dudas, contacta a tu administrador.`;

  await sendBotNotification(modelId, 'anticipo_rechazado', customMessage);
}

// Notificar anticipo confirmado por modelo
export async function notifyAdminsAnticipoConfirmado(
  modelId: string,
  modelName: string,
  montoSolicitado: number
): Promise<void> {
  try {
    const allAdminIds = await getAdminsForModel(modelId);

    if (allAdminIds.length === 0) return;

    const montoFormateado = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(montoSolicitado);

    const notificationPromises = allAdminIds.map(adminId => {
      const customMessage = `✅ La modelo **${modelName}** confirmó la recepción del anticipo de ${montoFormateado}.`;
      return sendBotNotification(adminId, 'anticipo_confirmado', customMessage);
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error notificando anticipo confirmado:', error);
  }
}

// Recordatorio de confirmar anticipo
export async function notifyAnticipoConfirmarRecordatorio(modelId: string): Promise<void> {
  await sendBotNotification(modelId, 'anticipo_confirmar_recordatorio');
}

// =====================================================
// 📦 NOTIFICACIONES DE PORTAFOLIO/PLATAFORMAS
// =====================================================

// Notificar plataforma entregada
export async function notifyPlataformaEntregada(
  modelId: string,
  platformName: string
): Promise<void> {
  const customMessage = `📦 Tu plataforma **${platformName}** ha sido entregada. Confirma la recepción para activarla en tu calculadora.`;
  await sendBotNotification(modelId, 'plataforma_entregada', customMessage);
}

// Notificar plataforma confirmada
export async function notifyPlataformaConfirmada(
  modelId: string,
  platformName: string
): Promise<void> {
  const customMessage = `✅ Plataforma **${platformName}** confirmada y activada exitosamente en tu calculadora.`;
  await sendBotNotification(modelId, 'plataforma_confirmada', customMessage);
}

// Notificar admins cuando modelo confirma plataforma
export async function notifyAdminsPlataformaConfirmada(
  modelId: string,
  modelName: string,
  platformName: string
): Promise<void> {
  try {
    const allAdminIds = await getAdminsForModel(modelId);
    if (allAdminIds.length === 0) return;

    const notificationPromises = allAdminIds.map(adminId => {
      const customMessage = `✅ La modelo **${modelName}** confirmó la recepción de la plataforma **${platformName}**.`;
      return sendBotNotification(adminId, 'plataforma_confirmada', customMessage);
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error notificando plataforma confirmada:', error);
  }
}

// Notificar nueva plataforma agregada
export async function notifyPlataformaAgregada(
  modelId: string,
  platformName: string
): Promise<void> {
  const customMessage = `➕ Se agregó la plataforma **${platformName}** a tu portafolio.`;
  await sendBotNotification(modelId, 'plataforma_agregada', customMessage);
}

// Notificar plataformas pendientes de confirmación
export async function notifyPlataformasPendientes(modelId: string, count: number): Promise<void> {
  const customMessage = `⏳ Tienes ${count} plataforma(s) entregada(s) esperando tu confirmación.`;
  await sendBotNotification(modelId, 'plataforma_pendiente_confirmacion', customMessage);
}

// =====================================================
// 🧮 NOTIFICACIONES DE CALCULADORA
// =====================================================

// Notificar meta del día alcanzada
export async function notifyMetaDiaAlcanzada(modelId: string): Promise<void> {
  await sendBotNotification(modelId, 'meta_dia_alcanzada');
}

// Notificar meta del período alcanzada
export async function notifyMetaPeriodoAlcanzada(modelId: string): Promise<void> {
  await sendBotNotification(modelId, 'meta_periodo_alcanzada');
}

// Notificar valores no ingresados
export async function notifyValoresNoIngresados(
  modelId: string,
  diasSinIngresar: number
): Promise<void> {
  const customMessage = `⚠️ No has ingresado valores desde hace ${diasSinIngresar} día(s). Recuerda mantener tus registros actualizados.`;
  await sendBotNotification(modelId, 'valores_no_ingresados', customMessage);
}

// Notificar cuota mínima en riesgo
export async function notifyCuotaMinimaRiesgo(
  modelId: string,
  porcentajeRestante: number
): Promise<void> {
  const customMessage = `📉 Estás al ${porcentajeRestante}% de tu cuota mínima. ¡Sigue así, puedes lograrlo!`;
  await sendBotNotification(modelId, 'cuota_minima_riesgo', customMessage);
}

// Notificar a admins sobre modelo sin ingresar valores
export async function notifyAdminsValoresNoIngresados(
  modelId: string,
  modelName: string,
  diasSinIngresar: number
): Promise<void> {
  try {
    const allAdminIds = await getAdminsForModel(modelId);
    if (allAdminIds.length === 0) return;

    const notificationPromises = allAdminIds.map(adminId => {
      const customMessage = `⚠️ La modelo **${modelName}** no ha ingresado valores desde hace ${diasSinIngresar} día(s).`;
      return sendBotNotification(adminId, 'valores_no_ingresados', customMessage);
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error notificando valores no ingresados:', error);
  }
}

// Notificar a admins sobre meta alcanzada
export async function notifyAdminsMetaAlcanzada(
  modelId: string,
  modelName: string,
  tipoMeta: 'día' | 'período'
): Promise<void> {
  try {
    const allAdminIds = await getAdminsForModel(modelId);
    if (allAdminIds.length === 0) return;

    const tipo = tipoMeta === 'día' ? 'del día' : 'del período';
    const notificationPromises = allAdminIds.map(adminId => {
      const customMessage = `🏆 La modelo **${modelName}** alcanzó su meta ${tipo}. ¡Felicitaciones!`;
      return sendBotNotification(adminId, 'metas_alcanzadas', customMessage);
    });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error notificando meta alcanzada:', error);
  }
}

// =====================================================
// 💬 NOTIFICACIONES DE CHAT
// =====================================================

// Notificar mensaje importante de admin
export async function notifyMensajeImportanteAdmin(
  modelId: string,
  adminName: string
): Promise<void> {
  const customMessage = `📩 Tienes un mensaje importante de **${adminName}**. Revisa tu chat.`;
  await sendBotNotification(modelId, 'mensaje_importante_admin', customMessage);
}

// Notificar escalamiento a admin
export async function notifyEscalamientoAdmin(modelId: string): Promise<void> {
  await sendBotNotification(modelId, 'escalamiento_admin');
}

// Notificar respuesta a escalamiento
export async function notifyRespuestaEscalamiento(modelId: string, adminName: string): Promise<void> {
  const customMessage = `💬 **${adminName}** respondió a tu consulta. Revisa tu chat.`;
  await sendBotNotification(modelId, 'respuesta_escalamiento', customMessage);
}

// Notificar a admin sobre nuevo mensaje de modelo
export async function notifyAdminNuevoMensajeModelo(
  adminId: string,
  modelName: string
): Promise<void> {
  const customMessage = `💬 Tienes un nuevo mensaje de **${modelName}**.`;
  await sendBotNotification(adminId, 'nuevo_mensaje_modelo', customMessage);
}

// Notificar consulta escalada
export async function notifyConsultaEscalada(
  adminId: string,
  modelName: string
): Promise<void> {
  const customMessage = `🚨 La modelo **${modelName}** necesita asistencia urgente. Revisa el chat.`;
  await sendBotNotification(adminId, 'consulta_escalada', customMessage);
}

// Notificar modelo solicita ayuda
export async function notifyModeloSolicitaAyuda(
  adminId: string,
  modelName: string
): Promise<void> {
  const customMessage = `🆘 La modelo **${modelName}** solicitó ayuda en el chat.`;
  await sendBotNotification(adminId, 'modelo_solicita_ayuda', customMessage);
}

// =====================================================
// ⚙️ NOTIFICACIONES DE SISTEMA
// =====================================================

// Notificar cambio de configuración
export async function notifyCambioConfiguracion(
  userId: string,
  area: string
): Promise<void> {
  const customMessage = `⚙️ Se actualizó la configuración de **${area}**.`;
  await sendBotNotification(userId, 'cambio_configuracion', customMessage);
}

// Notificar mantenimiento programado
export async function notifyMantenimientoProgramado(
  userId: string,
  fecha: string,
  detalles?: string
): Promise<void> {
  const customMessage = `🔧 El sistema estará en mantenimiento el **${fecha}**. ${detalles || ''}`;
  await sendBotNotification(userId, 'mantenimiento_programado', customMessage);
}

// Notificar nueva funcionalidad
export async function notifyNuevaFuncionalidad(
  userId: string,
  funcionalidad: string
): Promise<void> {
  const customMessage = `✨ Nueva funcionalidad disponible: **${funcionalidad}**. ¡Échale un vistazo!`;
  await sendBotNotification(userId, 'nueva_funcionalidad', customMessage);
}

// Notificar error crítico (solo admins)
export async function notifyErrorCritico(
  adminId: string,
  errorDescripcion: string
): Promise<void> {
  const customMessage = `🚨 Se detectó un error crítico: ${errorDescripcion}. Revisa los logs.`;
  await sendBotNotification(adminId, 'error_critico', customMessage);
}

// Notificar backup completado
export async function notifyBackupCompletado(adminId: string): Promise<void> {
  await sendBotNotification(adminId, 'backup_completado');
}

// Notificar actualización de sistema
export async function notifyActualizacionSistema(
  userId: string,
  version: string
): Promise<void> {
  const customMessage = `🔄 El sistema ha sido actualizado a la versión **${version}**.`;
  await sendBotNotification(userId, 'actualizacion_sistema', customMessage);
}



