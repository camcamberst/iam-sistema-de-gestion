/**
 * Configuración de niveles de seguridad para el chatbot
 */

export const SECURITY_LEVELS = {
  ULTRA_SAFE: {
    name: "Ultra Seguro",
    description: "Cero datos personales, respuestas genéricas, sin escalación",
    features: {
      anonymizeData: true,
      filterMessages: true,
      genericResponses: true,
      noEscalation: true,
      filterBotResponses: true
    },
    icon: "🛡️"
  },
  
  INTERMEDIATE: {
    name: "Intermedio",
    description: "Datos anonimizados, filtros básicos, escalación limitada",
    features: {
      anonymizeData: true,
      filterMessages: true,
      genericResponses: false,
      noEscalation: false,
      filterBotResponses: false
    },
    icon: "🔒"
  },
  
  BASIC: {
    name: "Básico",
    description: "Datos básicos, filtros en prompt, escalación completa",
    features: {
      anonymizeData: false,
      filterMessages: false,
      genericResponses: false,
      noEscalation: false,
      filterBotResponses: false
    },
    icon: "🔓"
  }
} as const;

export type SecurityLevel = keyof typeof SECURITY_LEVELS;

/**
 * Obtiene el nivel de seguridad actual desde variables de entorno
 */
export function getCurrentSecurityLevel(): SecurityLevel {
  const level = process.env.NEXT_PUBLIC_CHAT_SECURITY_LEVEL as SecurityLevel;
  return level && SECURITY_LEVELS[level] ? level : 'ULTRA_SAFE';
}

/**
 * Verifica si una característica está habilitada para el nivel actual
 */
export function isFeatureEnabled(feature: keyof typeof SECURITY_LEVELS.ULTRA_SAFE.features): boolean {
  const currentLevel = getCurrentSecurityLevel();
  return SECURITY_LEVELS[currentLevel].features[feature];
}
