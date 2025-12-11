'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ToastNotificationProps {
  id: string;
  senderName: string;
  senderAvatar?: string | null;
  messagePreview: string;
  conversationId: string;
  onOpenConversation: (conversationId: string) => void;
  onClose: (id: string) => void;
  duration?: number;
}

/**
 * Componente de notificación Toast estilo macOS/iOS
 * Aparece discretamente en la esquina superior derecha
 */
export default function ToastNotification({
  id,
  senderName,
  senderAvatar,
  messagePreview,
  conversationId,
  onOpenConversation,
  onClose,
  duration = 4000  // Reducido a 4 segundos para que desaparezcan más rápido
}: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [shouldClose, setShouldClose] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Pequeño delay para animación fade-in
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    
    const timer = setTimeout(() => {
      setShouldClose(true);
      setTimeout(() => {
        onClose(id);
      }, 300); // Tiempo para animación fade-out
    }, duration);

    return () => clearTimeout(timer);
  }, [isVisible, duration, id, onClose]);

  // Obtener inicial para el avatar
  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  // Truncar preview del mensaje
  const truncatedPreview = messagePreview.length > 50 
    ? messagePreview.substring(0, 50) + '...'
    : messagePreview;

  const handleClick = () => {
    onOpenConversation(conversationId);
    onClose(id);
  };

  if (!isMounted) return null;

  const toastContent = (
    <div
      className={`fixed top-4 right-4 z-[99999] max-w-sm transition-all duration-300 ${
        isVisible && !shouldClose
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-[-10px] pointer-events-none'
      }`}
      role="alert"
      aria-live="polite"
    >
      <div
        onClick={handleClick}
        className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-100 dark:border-gray-700/50 border-l-4 border-l-blue-500 rounded-lg shadow-2xl p-4 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 animate-fadeIn ring-1 ring-black/5 dark:ring-white/5"
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0 text-white font-bold text-sm tracking-wide">
            {senderAvatar ? (
              <img 
                src={senderAvatar} 
                alt={senderName}
                className="w-full h-full rounded-full object-cover ring-2 ring-white/20"
              />
            ) : (
              <span>
                {getInitial(senderName)}
              </span>
            )}
          </div>
          
          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {senderName}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
              {truncatedPreview}
            </div>
          </div>
          
          {/* Botón cerrar */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose(id);
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
            aria-label="Cerrar notificación"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  // 🔧 FIX: Verificar que document.body existe antes de usar createPortal
  if (typeof document === 'undefined' || !document.body) {
    return null;
  }

  return createPortal(toastContent, document.body);
}

