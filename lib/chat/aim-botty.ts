// AIM Botty - Sistema de Chatbot con IA
// ======================================

// ID especial para AIM Botty (debe ser un UUID válido o un identificador especial)
// Nota: Este debe ser un usuario real en la base de datos o usar un ID especial
export const AIM_BOTTY_ID = 'f91c0968-b587-46cf-9036-05a4ec795c7f';
export const AIM_BOTTY_NAME = 'Botty';
export const AIM_BOTTY_EMAIL = 'aim-botty@agencia-innova.com';

// Tipos de mensajes que puede enviar el bot
export type BotMessageType = 
  | 'notification' 
  | 'response' 
  | 'tip' 
  | 'support' 
  | 'escalation';

// Tipos de notificaciones
export type NotificationType = 
  // Anticipos
  | 'anticipo_pendiente'
  | 'anticipo_aprobado'
  | 'anticipo_rechazado'
  | 'anticipo_realizado'
  | 'anticipo_confirmado'
  | 'anticipo_confirmar_recordatorio'
  // Ahorros
  | 'savings_request'
  | 'savings_approved'
  | 'savings_rejected'
  | 'withdrawal_request'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'withdrawal_completed'
  | 'savings_adjustment'
  | 'savings_goal_completed'
  | 'savings_window_reminder'
  // Portafolio/Plataformas
  | 'pagina_confirmada'
  | 'plataforma_entregada'
  | 'plataforma_confirmada'
  | 'plataforma_agregada'
  | 'plataforma_pendiente_confirmacion'
  // Calculadora
  | 'periodo_cerrado'
  | 'metas_alcanzadas'
  | 'meta_periodo_alcanzada'
  | 'recordatorio_ingreso'
  | 'valores_no_ingresados'
  | 'cuota_minima_riesgo'
  | 'meta_dia_alcanzada'
  // Sistema/Alertas críticas
  | 'cron_failure_critical'
  // Chat
  | 'mensaje_importante_admin'
  | 'escalamiento_admin'
  | 'respuesta_escalamiento'
  | 'nuevo_mensaje_modelo'
  | 'consulta_escalada'
  | 'modelo_solicita_ayuda'
  // Sistema
  | 'nueva_publicacion'
  | 'cambio_configuracion'
  | 'mantenimiento_programado'
  | 'nueva_funcionalidad'
  | 'error_critico'
  | 'backup_completado'
  | 'actualizacion_sistema';

// Contexto del usuario para el bot
export interface UserContext {
  userId: string;
  role: 'super_admin' | 'admin' | 'modelo';
  name: string;
  email: string;
  groups?: string[];
  portfolio?: Array<{
    platform_id: string;
    platform_name: string;
    enabled: boolean;
  }>;
  recentActivity?: {
    lastAnticipo?: string;
    lastCalculatorEntry?: string;
    todayEarnings?: number;
  };
}

// Configuración del bot según rol
export function getBotPersonalityForRole(role: string): string {
  const personalities: Record<string, string> = {
    modelo: `Eres AIM Botty, tu asistente virtual y amigo 🤖. Ayudo a modelos de webcam de forma cercana y comprensiva.
      Tu personalidad:
      - Super amigable, cercano y empático (como un buen amigo)
      - Tono casual y cálido, sin formalidades
      - Entiendes perfectamente el mundo del entretenimiento para adultos
      - Sabes cómo puede ser este trabajo emocionalmente
      - Ofreces tips útiles sin ser condescendiente
      - Das apoyo emocional cuando se necesita
      - Siempre positivo y alentador
      - Hablas de tú, nunca de usted`,
    
    admin: `Eres AIM Botty, un asistente virtual cercano y útil para administradores. 
      Tu personalidad:
      - Amigable pero profesional
      - Directo y eficiente
      - Tono cercano, como un compañero de trabajo
      - Proactivo y útil
      - Siempre disponible para ayudar`,
    
    super_admin: `Eres AIM Botty, un asistente virtual cercano y eficiente para super administradores.
      Tu personalidad:
      - Amigable pero directo
      - Eficiente y claro
      - Tono cercano y profesional
      - Proactivo en reportar lo importante
      - Siempre útil y disponible`
  };

  return personalities[role] || personalities.modelo;
}

// Generar mensajes de notificación según el tipo
// Formato de enlaces: [LINK:texto|url] se convertirá en un enlace clickeable
export function generateNotificationMessage(
  type: NotificationType,
  context: UserContext
): string {
  const messages: Record<NotificationType, string> = {
    // Anticipos
    anticipo_pendiente: `📋 Hola ${context.name}! Tienes una nueva solicitud de anticipo pendiente de revisión. El administrador la revisará pronto.`,
    anticipo_aprobado: `✅ ¡Excelente noticia ${context.name}! Tu solicitud de anticipo ha sido aprobada. El pago se procesará según lo acordado.`,
    anticipo_rechazado: `⚠️ ${context.name}, tu solicitud de anticipo fue rechazada. Revisa los detalles en [LINK:Mis Anticipos|/admin/model/anticipos/solicitudes] o contacta a tu administrador si tienes dudas.`,
    anticipo_realizado: `💰 ${context.name}, tu anticipo ha sido pagado. Por favor [LINK:confirma la recepción|/admin/model/anticipos/solicitudes].`,
    anticipo_confirmado: `✅ ${context.name}, has confirmado la recepción de tu anticipo. ¡Gracias!`,
    anticipo_confirmar_recordatorio: `⏰ ${context.name}, recuerda [LINK:confirmar la recepción de tu anticipo pagado|/admin/model/anticipos/solicitudes].`,
    
    // Ahorros
    savings_request: `💰 ${context.name}, tienes una nueva solicitud de ahorro pendiente de revisión. [LINK:Revisar solicitudes|/admin/finanzas/ahorros]`,
    savings_approved: `✅ ${context.name}, tu solicitud de ahorro ha sido aprobada. El monto se ha guardado en tu cuenta de ahorros. [LINK:Ver mis ahorros|/admin/model/finanzas/ahorro]`,
    savings_rejected: `⚠️ ${context.name}, tu solicitud de ahorro fue rechazada. Revisa los detalles en [LINK:Mi Ahorro|/admin/model/finanzas/ahorro] o contacta a tu administrador si tienes dudas.`,
    withdrawal_request: `💸 ${context.name}, tienes una nueva solicitud de retiro de ahorro pendiente de revisión. [LINK:Revisar solicitudes|/admin/finanzas/retiros]`,
    withdrawal_approved: `✅ ${context.name}, tu solicitud de retiro ha sido aprobada. El pago se procesará según el tiempo estimado. [LINK:Ver mis retiros|/admin/model/finanzas/ahorro]`,
    withdrawal_rejected: `⚠️ ${context.name}, tu solicitud de retiro fue rechazada. Revisa los detalles en [LINK:Mi Ahorro|/admin/model/finanzas/ahorro] o contacta a tu administrador si tienes dudas.`,
    withdrawal_completed: `💰 ${context.name}, tu retiro ha sido procesado y enviado. Por favor confirma la recepción cuando lo recibas. [LINK:Ver mis retiros|/admin/model/finanzas/ahorro]`,
    savings_adjustment: `🔧 ${context.name}, se ha realizado un ajuste en tu cuenta de ahorros. [LINK:Ver detalles|/admin/model/finanzas/ahorro]`,
    savings_goal_completed: `🎉 ¡Felicidades ${context.name}! Has alcanzado tu meta de ahorro. ¡Sigue así! [LINK:Ver mis metas|/admin/model/finanzas/ahorro]`,
    savings_window_reminder: `💰 ${context.name}, recuerda que tienes tiempo limitado para solicitar ahorro. [LINK:Solicitar ahora|/admin/model/finanzas/ahorro/solicitar]`,
    
    // Portafolio/Plataformas
    pagina_confirmada: `🎉 ¡Felicidades ${context.name}! Se ha confirmado la entrega de tu página. ¡Excelente trabajo!`,
    plataforma_entregada: `📦 ${context.name}, tu plataforma ha sido entregada. [LINK:Confirma la recepción|/admin/model/portafolio] para activarla en tu calculadora.`,
    plataforma_confirmada: `✅ ${context.name}, plataforma confirmada y activada exitosamente en tu calculadora.`,
    plataforma_agregada: `➕ ${context.name}, se agregó una nueva plataforma a tu portafolio. [LINK:Ver portafolio|/admin/model/portafolio]`,
    plataforma_pendiente_confirmacion: `⏳ ${context.name}, hay plataformas entregadas esperando tu confirmación. [LINK:Revisar portafolio|/admin/model/portafolio]`,
    
    // Calculadora
    periodo_cerrado: `📊 ${context.name}, el período de facturación ha sido cerrado. Puedes [LINK:revisar tu resumen completo|/admin/model/dashboard] en el dashboard.`,
    metas_alcanzadas: `🏆 ¡Increíble ${context.name}! Has alcanzado tu meta del día. ¡Sigue así!`,
    meta_periodo_alcanzada: `🎯 ¡Excelente ${context.name}! Has alcanzado tu meta del período. ¡Felicitaciones!`,
    meta_dia_alcanzada: `⭐ ${context.name}, ¡alcanzaste tu meta del día!`,
    recordatorio_ingreso: `💡 ${context.name}, recuerda [LINK:ingresar tus valores del día|/admin/model/calculator] en Mi Calculadora para mantener tus registros al día.`,
    valores_no_ingresados: `⚠️ ${context.name}, no has ingresado valores desde hace varios días. [LINK:Actualiza tus registros|/admin/model/calculator] ahora.`,
    cuota_minima_riesgo: `📉 ${context.name}, estás cerca de no alcanzar tu cuota mínima. ¡Sigue así, puedes lograrlo!`,
    
    // Chat
    mensaje_importante_admin: `📩 ${context.name}, tienes un mensaje importante de tu administrador. [LINK:Revisa tu chat|#]`,
    escalamiento_admin: `🆘 ${context.name}, tu consulta ha sido escalada a un administrador. Te responderán pronto.`,
    respuesta_escalamiento: `💬 ${context.name}, un administrador respondió a tu consulta. [LINK:Revisa tu chat|#]`,
    nuevo_mensaje_modelo: `💬 ${context.name}, tienes un nuevo mensaje de una modelo. [LINK:Abrir chat|#]`,
    consulta_escalada: `🚨 ${context.name}, una modelo necesita asistencia urgente. [LINK:Revisar chat|#]`,
    modelo_solicita_ayuda: `🆘 ${context.name}, una modelo solicitó ayuda en el chat. [LINK:Abrir chat|#]`,
    
    // Sistema
    nueva_publicacion: `📌 ¡Hola ${context.name}! Hay una nueva publicación en el corcho informativo. [LINK:Revisa tu dashboard|/admin/model/dashboard] para ver los detalles.`,
    cambio_configuracion: `⚙️ ${context.name}, se actualizó la configuración del sistema.`,
    mantenimiento_programado: `🔧 ${context.name}, el sistema estará en mantenimiento. Revisa los detalles.`,
    nueva_funcionalidad: `✨ ${context.name}, hay una nueva funcionalidad disponible. ¡Échale un vistazo!`,
    error_critico: `🚨 ${context.name}, se detectó un error crítico en el sistema. Revisa los logs.`,
    backup_completado: `💾 ${context.name}, el backup del sistema se completó exitosamente.`,
    actualizacion_sistema: `🔄 ${context.name}, el sistema ha sido actualizado.`,
    cron_failure_critical: `🚨 ALERTA CRÍTICA: ${context.name}, un proceso automático crítico ha fallado. Se requiere acción manual inmediata.`
  };

  return messages[type] || `🔔 ${context.name}, tienes una nueva notificación.`;
}

// Verificar si un ID es del bot
export function isBottyId(userId: string): boolean {
  return userId === AIM_BOTTY_ID;
}

