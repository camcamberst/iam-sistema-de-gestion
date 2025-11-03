// Sistema de Avatares Simbólicos Elegantes para Usuarios
// =========================================================

import React from 'react';
import { AIM_BOTTY_ID, AIM_BOTTY_EMAIL } from './aim-botty';

/**
 * Genera un índice consistente basado en el identificador del usuario
 */
function getUserIndex(identifier: string): number {
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

/**
 * Obtiene un símbolo SVG para Super Admin
 */
function getSuperAdminSymbol(index: number): React.ReactElement {
  const symbols = [
    // Corona
    <svg key="crown" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M5 16L3 10l5.5-2L12 10l3.5-2L21 10l-2 6H5zm14.5-7.5L18.5 8l-3.5 1.5L12 8l-2.5 1.5L6 8l-1 0.5L5 11l14 0.5z"/>
      <circle cx="8" cy="16" r="1.5" fill="currentColor" opacity="0.8"/>
      <circle cx="16" cy="16" r="1.5" fill="currentColor" opacity="0.8"/>
      <circle cx="12" cy="14" r="1.5" fill="currentColor" opacity="0.9"/>
    </svg>,
    // Estrella destacada
    <svg key="star" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>,
    // Escudo
    <svg key="shield" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 19.95c-4.73-1.18-8-5.48-8-9.95V6.3l8-3.56v18.21z"/>
      <path d="M12 7.5l-1.5 3L8 11l2.25 2.25L9.75 16.5 12 14.75 14.25 16.5l-.5-3.25L16 11l-2.5-.5L12 7.5z"/>
    </svg>,
    // Diamante
    <svg key="diamond" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M6 2L2 8l10 14 10-14-4-6H6zm2.62 2h6.76L12 9.24 8.62 4zM4.12 8l2.5-2h6.76l2.5 2L12 19.24 4.12 8z"/>
    </svg>
  ];
  return symbols[index % symbols.length];
}

/**
 * Obtiene un símbolo SVG para Admin
 */
function getAdminSymbol(index: number): React.ReactElement {
  const symbols = [
    // Llave/engranaje
    <svg key="gear" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.4-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
    </svg>,
    // Documento/Clipboard
    <svg key="clipboard" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V5h2v3h10V5h2v16z"/>
      <path d="M7 11h10v2H7zm0 4h7v2H7z"/>
    </svg>,
    // Usuario con símbolo de gestión
    <svg key="user-management" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <circle cx="12" cy="8" r="3.5"/>
      <path d="M5 20c0-3.31 3.13-6 7-6s7 2.69 7 6v1H5v-1z"/>
      <path d="M18 11.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zm1.5 4.5h-3v-1h3v1z" opacity="0.8"/>
    </svg>,
    // Gráfico/Chart
    <svg key="chart" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
    </svg>
  ];
  return symbols[index % symbols.length];
}

/**
 * Obtiene un símbolo SVG para Modelos
 */
function getModelSymbol(index: number): React.ReactElement {
  const symbols = [
    // Flor elegante
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
    </svg>,
    // Estrella suave
    <svg key="star-soft" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 2l2.4 7.2L22 10l-6 5.8 1.4 8.2L12 19.5 6.6 24l1.4-8.2L2 10l7.6-.8L12 2z" opacity="0.9"/>
      <path d="M12 5.5l1.8 5.4L18 10.5l-4.5 4.3 1 6.2L12 17.8l-2.5 3.2 1-6.2L6 10.5l4.2-.6L12 5.5z" opacity="0.6"/>
    </svg>,
    // Corazón elegante
    <svg key="heart" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>,
    // Burbuja/Círculo elegante
    <svg key="circle-elegant" viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.9"/>
      <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.6"/>
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3"/>
    </svg>
  ];
  return symbols[index % symbols.length];
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
  const identifier = user?.email || user?.name || user?.id || '';
  
  const gradient = getAvatarGradient(role, isOffline, isBotty);
  const userIndex = getUserIndex(identifier);
  
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

  // Obtener símbolo según el rol
  let symbol: React.ReactElement;
  if (role === 'super_admin') {
    symbol = getSuperAdminSymbol(userIndex);
  } else if (role === 'admin') {
    symbol = getAdminSymbol(userIndex);
  } else {
    symbol = getModelSymbol(userIndex);
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

