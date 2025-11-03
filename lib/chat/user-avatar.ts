// Sistema de Avatares Simbólicos para Usuarios
// ==============================================

import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from './aim-botty';

/**
 * Genera un avatar simbólico basado en el rol del usuario
 * Retorna un emoji que representa visualmente al usuario
 */
export function getSymbolicAvatar(user: {
  id?: string;
  email?: string;
  role?: string;
  name?: string;
}): string {
  // AIM Botty siempre tiene el mismo avatar
  if (user.id === AIM_BOTTY_ID || user.email === AIM_BOTTY_EMAIL) {
    return '🤖';
  }

  const role = user.role || 'modelo';
  const identifier = user.email || user.name || user.id || '';

  // Generar un índice consistente basado en el email/nombre
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash);

  // Diferentes conjuntos de emojis según el rol
  if (role === 'super_admin') {
    // Emojis de liderazgo y administración superior
    const avatars = ['👑', '⭐', '🌟', '🎯', '💎', '🏆', '⚡', '🔥'];
    return avatars[index % avatars.length];
  } else if (role === 'admin') {
    // Emojis de administración y gestión
    const avatars = ['👔', '📊', '🔧', '⚙️', '📋', '📝', '🎖️', '💼'];
    return avatars[index % avatars.length];
  } else {
    // Emojis para modelos (personas, artistas, estrellas)
    const avatars = [
      '✨', '💫', '🌺', '🌸', '🌷', '🌹', '🌻', '🌼',
      '⭐', '🌟', '💖', '💝', '🎀', '🎁', '🎊', '🎉',
      '🦋', '🐝', '🌙', '☀️', '🌈', '💐', '🌿', '🍀'
    ];
    return avatars[index % avatars.length];
  }
}

/**
 * Obtiene el gradiente de color para el avatar basado en el rol y estado
 */
export function getAvatarGradient(
  role?: string,
  isOffline: boolean = false,
  isBotty: boolean = false
): string {
  if (isBotty) {
    return 'bg-gradient-to-br from-purple-500 via-indigo-500 to-purple-600';
  }

  if (isOffline) {
    return 'bg-gradient-to-br from-gray-500 to-gray-600';
  }

  if (role === 'super_admin') {
    return 'bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500';
  } else if (role === 'admin') {
    return 'bg-gradient-to-br from-blue-500 to-indigo-600';
  } else {
    return 'bg-gradient-to-br from-pink-500 via-rose-500 to-purple-500';
  }
}

