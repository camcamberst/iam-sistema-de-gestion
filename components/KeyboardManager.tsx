'use client';

import { useEffect } from 'react';

export default function KeyboardManager() {
  useEffect(() => {
    // Escucha globalmente si un input o textarea es el elemento activo
    const handleFocus = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Añadimos una clase global al body para que cualquier componente sepa que el teclado virtual está desplegado
        document.body.classList.add('keyboard-open');

        // Retrasamos el scroll justito lo que dura la animación del teclado nativo (aprox 300ms)
        setTimeout(() => {
          // Si el elemento sigue enfocado (previene saltos si el usuario tapeó otra cosa en milisegundos)
          if (document.activeElement === target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          }
        }, 300);
      }
    };

    const handleBlur = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Redujimos la latencia drásticamente; 20ms es suficiente para atrapar saltos de foco entre dos inputs
        setTimeout(() => {
          const active = document.activeElement;
          if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
            document.body.classList.remove('keyboard-open');
          }
        }, 20);
      }
    };

    // focusin y focusout burbujean (a diferencia de focus/blur vacíos)
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
      document.body.classList.remove('keyboard-open');
    };
  }, []);

  return null;
}
