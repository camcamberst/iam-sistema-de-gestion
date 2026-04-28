'use client';

import { useState, useEffect } from 'react';

export default function KeyboardSimulator() {
  const [isActive, setIsActive] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const handleFocus = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsKeyboardOpen(true);
      }
    };

    const handleBlur = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Un pequeño retraso para permitir clics dentro del teclado simulado (como el botón Done)
        setTimeout(() => setIsKeyboardOpen(false), 100);
      }
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, [isActive]);

  useEffect(() => {
    if (isKeyboardOpen && isActive) {
      // Simular que el viewport se encoge en 330px
      document.documentElement.style.setProperty('--vh-offset', '330px');
      document.body.classList.add('keyboard-simulated');
      document.body.style.height = 'calc(100vh - 330px)';
      document.body.style.overflow = 'hidden'; 
    } else {
      document.documentElement.style.removeProperty('--vh-offset');
      document.body.classList.remove('keyboard-simulated');
      document.body.classList.remove('keyboard-open'); // Forzar limpieza en caso de que el blur del input se lo trague React
      document.body.style.height = '';
      document.body.style.overflow = '';
    }

    return () => {
      document.documentElement.style.removeProperty('--vh-offset');
      document.body.classList.remove('keyboard-simulated');
      document.body.classList.remove('keyboard-open');
      document.body.style.height = '';
      document.body.style.overflow = '';
    };
  }, [isKeyboardOpen, isActive]);

  return (
    <>
      {/* Botón Flotante para Activar el Simulador */}
      <div className="fixed top-1/2 -left-12 hover:left-0 -translate-y-1/2 z-[99999] flex flex-col gap-2 transition-all duration-300">
        <button
          onClick={() => setIsActive(!isActive)}
          className={`px-4 py-2 rounded-r-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] text-xs font-bold transition-all border border-l-0 ${
            isActive 
              ? 'bg-blue-600 text-white border-blue-500' 
              : 'bg-white/80 dark:bg-black/80 backdrop-blur-md text-gray-800 dark:text-white border-black/10 dark:border-white/10'
          }`}
          title="Simular Teclado Móvil"
        >
          {isActive ? '⌨️ Sim. ON' : '⌨️ Simular Teclado'}
        </button>
      </div>

      {/* Interfaz Ficticia del Teclado */}
      {isKeyboardOpen && isActive && (
        <div 
          className="fixed bottom-0 left-0 right-0 h-[330px] bg-[#d1d5db] dark:bg-[#1f2937] border-t border-gray-300 dark:border-gray-700 z-[99999] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.2)]"
        >
          {/* Barra de accesorios del teclado (como Safari/Chrome iOS) */}
          <div className="h-12 bg-[#e5e7eb] dark:bg-[#374151] flex items-center justify-between px-4 border-b border-gray-300/50 dark:border-gray-700/50">
            <span className="text-gray-500 dark:text-gray-400 text-xs font-medium">Teclado Simulado (330px)</span>
            <button 
              onMouseDown={(e) => {
                // Prevent focus drop before handling
                e.preventDefault();
                setIsKeyboardOpen(false);
                (document.activeElement as HTMLElement)?.blur();
              }}
              className="text-blue-500 dark:text-blue-400 text-sm font-semibold hover:opacity-80 active:scale-95"
            >
              Done
            </button>
          </div>
          {/* Teclado Per Se */}
          <div className="flex-1 flex items-center justify-center bg-gray-300/50 dark:bg-[#111827]">
            <div className="text-gray-400 dark:text-gray-600/50 text-xl font-black tracking-widest uppercase flex flex-col items-center gap-2">
              <span>Q W E R T Y</span>
              <span>A S D F G</span>
              <span>Z X C V</span>
              <div className="w-48 h-8 rounded-md bg-gray-400/20 dark:bg-white/5 mt-4"></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
