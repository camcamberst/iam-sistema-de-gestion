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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => {
      cancelAnimationFrame(id);
      setMounted(false);
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
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 200ms ease-in-out'
      }}
      onClick={() => { if (closeOnBackdrop) onClose(); }}
      aria-modal="true"
      role="dialog"
    >
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '28px',
          width: '100%',
          maxWidth: '1024px',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.95)',
          transition: 'all 200ms ease-out'
        }}
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


