// Sistema de Avatares Simbólicos Elegantes para Usuarios
// =========================================================

import React from 'react';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from './aim-botty';


/**
 * Obtiene el símbolo SVG fijo para Super Admin
 * Todos los super admins tienen el mismo símbolo: Corona
 */
function getSuperAdminSymbol(): React.ReactElement {
  return (
    <svg key="crown" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M5 16L3 10l5.5-2L12 10l3.5-2L21 10l-2 6H5zm14.5-7.5L18.5 8l-3.5 1.5L12 8l-2.5 1.5L6 8l-1 0.5L5 11l14 0.5z"/>
      <circle cx="8" cy="16" r="1.5" fill="currentColor" opacity="0.8"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor" opacity="0.8"/>
      <circle cx="12" cy="14" r="1.5" fill="currentColor" opacity="0.9"/>
    </svg>
  );
}

/**
 * Obtiene el símbolo SVG fijo para Admin
 * Todos los admins tienen el mismo símbolo: Engranaje
 */
function getAdminSymbol(): React.ReactElement {
  return (
    <svg key="gear" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.4-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
    </svg>
  );
}

/**
 * Obtiene el símbolo SVG fijo para Modelos
 * Todos los modelos tienen el mismo símbolo: Flor elegante
 */
function getModelSymbol(): React.ReactElement {
  return (
    <svg key="flower" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
      <circle cx="12" cy="8" r="1.5" fill="currentColor" opacity="0.8"/>
      <circle cx="12" cy="16" r="1.5" fill="currentColor" opacity="0.8"/>
      <circle cx="8" cy="12" r="1.5" fill="currentColor" opacity="0.8"/>
      <circle cx="16" cy="12" r="1.5" fill="currentColor" opacity="0.8"/>
      <circle cx="10" cy="10" r="1.2" fill="currentColor" opacity="0.7"/>
      <circle cx="14" cy="10" r="1.2" fill="currentColor" opacity="0.7"/>
      <circle cx="10" cy="14" r="1.2" fill="currentColor" opacity="0.7"/>
      <circle cx="14" cy="14" r="1.2" fill="currentColor" opacity="0.7"/>
    </svg>
  );
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
 * Renderiza un avatar simbólico elegante diferenciado por rol
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
  
  const gradient = getAvatarGradient(role, isOffline, isBotty);
  
  const sizeClass = size === 'small' ? 'w-6 h-6' : 'w-8 h-8';
  const iconSize = size === 'small' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  const borderClass = isBotty ? 'rounded-xl border border-purple-400/30' : 'rounded-full';
  const shadowClass = size === 'medium' ? 'shadow-md' : 'shadow-sm';

  // Para Botty, usar emoji especial
  if (isBotty) {
    return (
      <div className={`${sizeClass} ${gradient} ${borderClass} flex items-center justify-center ${shadowClass} flex-shrink-0`}>
        <span className="text-xs leading-none">🤖</span>
      </div>
    );
  }

  // Obtener símbolo fijo según el rol (todos los usuarios del mismo rol tienen el mismo símbolo)
  let symbol: React.ReactElement;
  if (role === 'super_admin') {
    symbol = getSuperAdminSymbol();
  } else if (role === 'admin') {
    symbol = getAdminSymbol();
  } else {
    symbol = getModelSymbol();
  }

  // Renderizar avatar con símbolo
  return (
    <div 
      className={`${sizeClass} ${gradient} ${borderClass} flex items-center justify-center ${shadowClass} flex-shrink-0 relative overflow-hidden border border-white/20`}
    >
      <div className={`${iconSize} text-white flex items-center justify-center`}>
        {symbol}
      </div>
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

