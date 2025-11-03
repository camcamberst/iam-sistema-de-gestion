// Sistema de Avatares Elegantes para Usuarios
// ============================================

import React from 'react';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from './aim-botty';

/**
 * Obtiene la inicial del nombre del usuario (estilizada)
 */
function getUserInitial(name?: string, email?: string): string {
  const displayName = name || email || '';
  if (!displayName) return '?';
  return displayName.charAt(0).toUpperCase();
}

/**
 * Genera un patrón visual consistente basado en el identificador del usuario
 * Retorna un número entre 0-3 para patrones de diseño
 */
function getVisualPattern(identifier: string): number {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 4;
}

/**
 * Obtiene el gradiente de color para el avatar basado en el rol y estado
 * Alineado con Apple Style 2 del proyecto
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
    // Dorado/Ambar elegante para super admin
    return 'bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600';
  } else if (role === 'admin') {
    // Azul corporativo (estilo Apple Style 2)
    return 'bg-gradient-to-br from-blue-500 to-indigo-600';
  } else {
    // Rosa/Púrpura suave para modelos
    return 'bg-gradient-to-br from-pink-500 via-rose-500 to-purple-500';
  }
}

/**
 * Renderiza un avatar elegante con diseño visual diferenciado por rol
 */
export function renderElegantAvatar(
  user: {
    id?: string;
    email?: string;
    role?: string;
    name?: string;
  },
  size: 'small' | 'medium' = 'medium',
  isOffline: boolean = false
): React.ReactElement {
  const isBotty = user?.id === AIM_BOTTY_ID || user?.email === AIM_BOTTY_EMAIL;
  const role = user?.role || 'modelo';
  const identifier = user?.email || user?.name || user?.id || '';
  
  const initial = getUserInitial(user?.name, user?.email);
  const gradient = getAvatarGradient(role, isOffline, isBotty);
  const pattern = getVisualPattern(identifier);
  
  const sizeClass = size === 'small' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';
  const borderClass = isBotty ? 'rounded-xl border border-purple-400/30' : 'rounded-full';
  const shadowClass = size === 'medium' ? 'shadow-md' : 'shadow-sm';

  // Patrón de diseño según el hash
  const getPatternStyle = () => {
    if (pattern === 0) {
      // Patrón sólido con inicial
      return { background: 'transparent' };
    } else if (pattern === 1) {
      // Patrón con anillo interno
      return {
        background: 'radial-gradient(circle, transparent 30%, rgba(255,255,255,0.15) 30%)'
      };
    } else if (pattern === 2) {
      // Patrón con línea diagonal sutil
      return {
        background: 'linear-gradient(135deg, transparent 45%, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.1) 55%, transparent 55%)'
      };
    } else {
      // Patrón con anillo externo
      return {
        background: 'radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%)'
      };
    }
  };

  // Para Botty, usar emoji especial
  if (isBotty) {
    return (
      <div className={`${sizeClass} ${gradient} ${borderClass} flex items-center justify-center ${shadowClass} flex-shrink-0`}>
        <span className="text-xs leading-none">🤖</span>
      </div>
    );
  }

  // Para usuarios, usar inicial estilizada con patrón
  return (
    <div 
      className={`${sizeClass} ${gradient} ${borderClass} flex items-center justify-center ${shadowClass} flex-shrink-0 relative overflow-hidden border border-white/20`}
      style={getPatternStyle()}
    >
      <span className="text-white font-bold tracking-wider relative z-10 drop-shadow-sm">
        {initial}
      </span>
    </div>
  );
}

/**
 * Exportar función compatible con el código existente
 * Retorna el JSX del avatar directamente
 */
export function getSymbolicAvatar(user: any): React.ReactElement {
  return renderElegantAvatar(user);
}

