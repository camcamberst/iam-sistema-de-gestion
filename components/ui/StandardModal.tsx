"use client";

import React, { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxWidthClass?: string; // ej: max-w-md, max-w-lg, max-w-2xl
  paddingClass?: string; // ej: p-8, p-7
  headerMarginClass?: string; // ej: mb-6, mb-5
  formSpaceYClass?: string; // ej: space-y-6, space-y-5
  className?: string; // clases adicionales del contenedor
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
}

export default function StandardModal({
  isOpen,
  onClose,
  children,
  title,
  maxWidthClass = 'max-w-lg',
  paddingClass = 'p-7',
  headerMarginClass = 'mb-5',
  formSpaceYClass = 'space-y-5',
  className = '',
  showCloseButton = true,
  closeOnBackdrop = true
}: StandardModalProps) {
  const [mounted, setMounted] = useState(false);

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Asegurar que el componente esté montado antes de usar createPortal
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  // Verificar que document.body existe antes de usar createPortal
  if (typeof document === 'undefined' || !document.body) {
    return null;
  }

  // Debug: verificar que el modal se está intentando renderizar
  if (isOpen) {
    console.log('🔵 StandardModal: Renderizando modal', { isOpen, mounted, hasBody: !!document.body });
  }

  const modalContent = (
    <div
      onClick={() => { if (closeOnBackdrop) onClose(); }}
      aria-modal="true"
      role="dialog"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: '1rem'
      }}
    >
      <div
        className={`${paddingClass} w-full ${maxWidthClass} max-h-[calc(100vh-2rem)] overflow-y-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
        style={{ 
          position: 'relative',
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'block',
          visibility: 'visible',
          opacity: 1
        }}
      >
        {(title || showCloseButton) && (
          <div className={`flex items-center justify-between ${headerMarginClass}`}>
            {title ? (
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
            ) : <div />}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Cerrar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className={formSpaceYClass}>
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}


