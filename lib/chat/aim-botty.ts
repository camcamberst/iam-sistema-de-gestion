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
  | 'recordatorio_ingreso'
  | 'nueva_publicacion';

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
    
    recordatorio_ingreso: `💡 ${context.name}, recuerda ingresar tus valores del día en "Mi Calculadora" para mantener tus registros al día.`,
    
    nueva_publicacion: `📌 ¡Hola ${context.name}! Hay una nueva publicación en el corcho informativo. Revisa tu dashboard para ver los detalles.`
  };

  return messages[type] || `🔔 ${context.name}, tienes una nueva notificación.`;
}

// Verificar si un ID es del bot
export function isBottyId(userId: string): boolean {
  return userId === AIM_BOTTY_ID;
}

