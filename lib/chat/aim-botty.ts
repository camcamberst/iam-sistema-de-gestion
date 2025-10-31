// AIM Botty - Sistema de Chatbot con IA
// ======================================

// ID especial para AIM Botty (debe ser un UUID válido o un identificador especial)
// Nota: Este debe ser un usuario real en la base de datos o usar un ID especial
export const AIM_BOTTY_ID = 'f91c0968-b587-46cf-9036-05a4ec795c7f';
export const AIM_BOTTY_NAME = 'AIM Botty';
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
  | 'anticipo_pendiente'
  | 'anticipo_aprobado'
  | 'anticipo_rechazado'
  | 'pagina_confirmada'
  | 'periodo_cerrado'
  | 'metas_alcanzadas'
  | 'recordatorio_ingreso';

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
    modelo: `Eres AIM Botty, un asistente virtual amigable y empático especializado en ayudar a modelos de webcam. 
      Tu personalidad es:
      - Amigable, cálido y motivador
      - Profesional pero cercano
      - Conocedor del mundo del entretenimiento para adultos
      - Entendido sobre el trabajo emocional que implica esta profesión
      - Proactivo en ofrecer tips y consejos
      - Capaz de dar consejería emocional cuando se requiere
      - Siempre mantén un tono positivo y de apoyo`,
    
    admin: `Eres AIM Botty, un asistente virtual profesional especializado en ayudar a administradores de agencia.
      Tu personalidad es:
      - Profesional, eficiente y organizado
      - Directo pero respetuoso
      - Enfocado en métricas y reportes
      - Proactivo en reportar actividades relevantes
      - Capaz de resumir información importante
      - Siempre mantén un tono profesional y útil`,
    
    super_admin: `Eres AIM Botty, un asistente virtual ejecutivo especializado en ayudar a super administradores.
      Tu personalidad es:
      - Ejecutivo y estratégico
      - Eficiente y directo
      - Enfocado en el panorama general
      - Proactivo en reportar tendencias y alertas importantes
      - Capaz de proporcionar insights de alto nivel
      - Siempre mantén un tono profesional y estratégico`
  };

  return personalities[role] || personalities.modelo;
}

// Generar mensajes de notificación según el tipo
export function generateNotificationMessage(
  type: NotificationType,
  context: UserContext
): string {
  const messages: Record<NotificationType, string> = {
    anticipo_pendiente: `📋 Hola ${context.name}! Tienes una nueva solicitud de anticipo pendiente de revisión. El administrador la revisará pronto.`,
    
    anticipo_aprobado: `✅ ¡Excelente noticia ${context.name}! Tu solicitud de anticipo ha sido aprobada. El pago se procesará según lo acordado.`,
    
    anticipo_rechazado: `⚠️ ${context.name}, tu solicitud de anticipo fue rechazada. Revisa los detalles en "Mis Anticipos" o contacta a tu administrador si tienes dudas.`,
    
    pagina_confirmada: `🎉 ¡Felicidades ${context.name}! Se ha confirmado la entrega de tu página. ¡Excelente trabajo!`,
    
    periodo_cerrado: `📊 ${context.name}, el período de facturación ha sido cerrado. Puedes revisar tu resumen completo en el dashboard.`,
    
    metas_alcanzadas: `🏆 ¡Increíble ${context.name}! Has alcanzado tu meta del día. ¡Sigue así!`,
    
    recordatorio_ingreso: `💡 ${context.name}, recuerda ingresar tus valores del día en "Mi Calculadora" para mantener tus registros al día.`
  };

  return messages[type] || `🔔 ${context.name}, tienes una nueva notificación.`;
}

// Verificar si un ID es del bot
export function isBottyId(userId: string): boolean {
  return userId === AIM_BOTTY_ID;
}

