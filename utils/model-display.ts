/**
 * Utilidad para formatear nombres de modelos desde email
 * Convierte "angelica.winter@example.com" a "AngelicaWinter"
 */

export const getModelDisplayName = (email: string): string => {
  if (!email) return '';
  
  const beforeAt = email.split('@')[0];
  return beforeAt
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
};

// Ejemplos de uso:
// "angelica.winter@example.com" → "AngelicaWinter"
// "elizabeth.pineda@example.com" → "ElizabethPineda"
// "maria.garcia@example.com" → "MariaGarcia"
// "juan.perez@example.com" → "JuanPerez"
