"use client";

import React, { useEffect, useState, ReactNode } from 'react';

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
  const [bodyOverflow, setBodyOverflow] = useState<string | null>(null);

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow || '';
    setBodyOverflow(previousOverflow);
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={() => { if (closeOnBackdrop) onClose(); }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl shadow-xl ${paddingClass} w-full ${maxWidthClass} max-h-[calc(100vh-2rem)] overflow-y-auto transform transition-all duration-200 ease-out opacity-100 scale-100 ${className}`}
        onClick={(e) => e.stopPropagation()}
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
}


